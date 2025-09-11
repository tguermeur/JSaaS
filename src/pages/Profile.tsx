import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Link,
  Dialog,
  DialogContent,
  Avatar,
  Tabs,
  Tab,
  Divider,
  Stack,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  InputLabel,
  FormControl,
  FormHelperText,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  CloudUpload as CloudUploadIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  Reply as ReplyIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Payment as PaymentIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { updateUserDocument } from '../firebase/firestore';
import { uploadCV, uploadProfilePicture } from '../firebase/storage';
import { styled } from '@mui/material';
import { UserData } from '../types/user';
import { updateProfile } from 'firebase/auth';
import { auth } from '../firebase/config';
import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, serverTimestamp, deleteDoc, arrayUnion, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Report, getReports } from '../services/reportService';
import { useLocation, useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';
import { useNotifications } from '../contexts/NotificationContext';

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
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Ajout des types pour les nouvelles informations
interface ExtendedUserData extends UserData {
  birthPlace?: string;
  postalCode?: string;
  gender?: 'M' | 'F' | 'Autre';
  nationality?: string;
  studentId?: string;
  address?: string;
  socialSecurityNumber?: string;
  phone?: string;
  linkedinUrl?: string;
  profileCompletion?: number;
  updatedAt?: Date;
}

// Ajouter ces styles personnalisés pour les TextField
const textFieldStyles = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#f8f9fa',
    '& fieldset': {
      borderColor: 'transparent',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(0, 0, 0, 0.1)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'primary.main',
      borderWidth: '1px',
    },
    '&.Mui-disabled': {
      backgroundColor: '#f8f9fa',
      '& fieldset': { borderColor: 'transparent' },
    },
    '& .MuiInputBase-input': {
      fontSize: '0.875rem',
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      lineHeight: 1.5,
      padding: '10px 14px',
      textAlign: 'left',
      '&::placeholder': {
        fontSize: '0.875rem',
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      }
    }
  },
  '& .MuiInputLabel-root': {
    color: 'text.secondary',
    fontSize: '0.875rem',
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    '&.Mui-focused': {
      color: 'text.primary',
    },
  },
  '& .MuiSelect-select': {
    fontSize: '0.875rem',
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    lineHeight: 1.5,
    padding: '10px 14px',
    textAlign: 'left',
  },
  '& .MuiMenuItem-root': {
    fontSize: '0.875rem',
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    lineHeight: 1.5,
  },
  mb: 2
};

// Style commun pour les labels des inputs
const inputLabelStyle = {
  color: 'text.secondary', 
  fontSize: '0.75rem',
  mr: 1,
  whiteSpace: 'nowrap',
  minWidth: 'fit-content', // Permet au label de prendre la largeur nécessaire
  flexShrink: 0 // Empêche le label de se rétrécir
};

interface Notification {
  id: string;
  type: 'report_update' | 'report_response';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  reportId: string;
}

interface ExtendedReport extends Report {
  id: string;
  response?: string;
  responses?: Array<{
    text: string;
    timestamp: string;
    author: string;
  }>;
}

// Ajout des interfaces pour les missions
interface Mission {
  id: string;
  numeroMission: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  title: string;
  hours: number;
  etape: 'Négociation' | 'Recrutement' | 'Facturation' | 'Audit';
  chargeId: string;
  chargeName: string;
}

interface ExpenseNote {
  id: string;
  missionId: string;
  userId: string;
  amount: number;
  description: string;
  date: Date;
  status: 'En attente' | 'Validée' | 'Refusée';
  attachmentUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Application {
  id: string;
  userId: string;
  missionId: string;
  status: 'En attente' | 'Acceptée' | 'Refusée';
  createdAt: Date;
  updatedAt: Date;
  userEmail: string;
  isDossierValidated?: boolean;
  workingHours?: Array<{
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    breaks: Array<{ start: string; end: string; }>;
  }>;
  mission?: Mission;
}

// Ajout d'une fonction utilitaire pour calculer les heures planifiées
const calculatePlannedHours = (workingHours?: Array<{
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  breaks: Array<{ start: string; end: string; }>;
}>): number => {
  if (!workingHours) return 0;
  
  return workingHours.reduce((total, wh) => {
    const start = new Date(`${wh.startDate}T${wh.startTime}`);
    const end = new Date(`${wh.endDate}T${wh.endTime}`);
    
    // Calculer le temps total des pauses
    const breakTime = wh.breaks?.reduce((bt, b) => {
      const breakStart = new Date(`1970-01-01T${b.start}`);
      const breakEnd = new Date(`1970-01-01T${b.end}`);
      return bt + ((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60));
    }, 0) || 0;
    
    // Calculer les heures planifiées pour cette période
    const periodHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return total + (periodHours - breakTime);
  }, 0);
};

// Ajout d'une fonction utilitaire pour calculer les heures travaillées
const calculateWorkedHours = (workingHours?: Array<{
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  breaks: Array<{ start: string; end: string; }>;
}>): number => {
  if (!workingHours) return 0;
  
  return workingHours.reduce((total, wh) => {
    const start = new Date(`${wh.startDate}T${wh.startTime}`);
    const end = new Date(`${wh.endDate}T${wh.endTime}`);
    
    // Calculer le temps total des pauses
    const breakTime = wh.breaks?.reduce((bt, b) => {
      const breakStart = new Date(`1970-01-01T${b.start}`);
      const breakEnd = new Date(`1970-01-01T${b.end}`);
      return bt + ((breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60));
    }, 0) || 0;
    
    // Calculer les heures travaillées pour cette période
    const periodHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return total + (periodHours - breakTime);
  }, 0);
};



// Ajouter cette fonction après les autres fonctions utilitaires
const uploadExpenseAttachment = async (file: File, userId: string, missionId: string): Promise<string> => {
  try {
    // Créer un nom de fichier unique
    const timestamp = Date.now();
    const fileName = `expenses/${userId}/${missionId}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, fileName);

    // Uploader le fichier
    await uploadBytes(storageRef, file);

    // Obtenir l'URL de téléchargement
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Erreur lors de l\'upload du justificatif:', error);
    throw new Error('Erreur lors de l\'upload du justificatif');
  }
};

export default function Profile(): JSX.Element {
  const { currentUser, loading: authLoading, isAuthenticated, userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ExtendedUserData | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [expenseNotes, setExpenseNotes] = useState<ExpenseNote[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [newExpense, setNewExpense] = useState<{
    amount: number;
    description: string;
    date: string;
    attachmentUrl?: string;
  }>({
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newCV, setNewCV] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [openPreview, setOpenPreview] = useState(false);
  const [newProfilePicture, setNewProfilePicture] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [showCompletion, setShowCompletion] = useState(true);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: boolean}>({});
  const [userReports, setUserReports] = useState<ExtendedReport[]>([]);
  const [hasReports, setHasReports] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showResponseInput, setShowResponseInput] = useState<{[key: string]: boolean}>({});
  const [responseText, setResponseText] = useState<{[key: string]: string}>({});
  const [localLoading, setLocalLoading] = useState(true);
  const [programs, setPrograms] = useState<string[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editedExpense, setEditedExpense] = useState<{
    description: string;
    amount: number;
    date: string;
  }>({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0]
  });
  const { sendNotification } = useNotifications();

  console.log('Profile - État actuel:', {
    user: currentUser ? 'Présent' : 'Absent',
    authLoading,
    isAuthenticated,
    userData: userData ? 'Présent' : 'Absent',
    localLoading,
    isLoading
  });

  // Effet pour vérifier l'authentification
  useEffect(() => {
    console.log('Profile - useEffect - Vérification de l\'authentification');
    
    // Ajouter un délai pour permettre à l'authentification de se stabiliser
    const timer = setTimeout(() => {
      console.log('Profile - Vérification après délai:', {
        authLoading,
        isAuthenticated,
        user: currentUser ? 'Présent' : 'Absent'
      });
      
      if (!authLoading && !isAuthenticated) {
        console.log('Profile - Redirection vers login (non authentifié)');
        navigate('/login');
      } else if (!authLoading && isAuthenticated) {
        console.log('Profile - Utilisateur authentifié, fin du chargement local');
        setLocalLoading(false);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [authLoading, isAuthenticated, navigate, currentUser]);

  // Fonction pour charger les rapports de l'utilisateur
  const fetchUserReports = async () => {
    if (!currentUser?.uid) return;
    
    try {
      const reportsQuery = query(
        collection(db, 'reports'),
        where('userId', '==', currentUser.uid)
      );
      const reportsSnapshot = await getDocs(reportsQuery);
      const reports = reportsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExtendedReport[];
      
      setUserReports(reports);
      setHasReports(reports.length > 0);
    } catch (error) {
      console.error('Erreur lors du chargement des rapports:', error);
    }
  };

  // Fonction pour charger les notifications
  const fetchNotifications = async () => {
    if (!currentUser?.uid) return;
    
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      const notificationsData = notificationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Notification[];
      
      setNotifications(notificationsData);
      setUnreadNotifications(notificationsData.filter(n => !n.read).length);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    }
  };

  // Effet pour faire disparaître le message de succès après 5 secondes
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setProfileData(userDoc.data() as ExtendedUserData);
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des données:', error);
          setError('Erreur lors de la récupération des données');
        }
      }
    };

    fetchUserData();
  }, [currentUser]);

  // Effet pour charger les rapports de l'utilisateur au montage
  useEffect(() => {
    fetchUserReports();
  }, [currentUser]);

  // Effet pour charger les notifications au montage et quand l'utilisateur change
  useEffect(() => {
    fetchNotifications();
  }, [currentUser]);

  // Effet pour détecter le paramètre d'URL et définir l'onglet actif
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    
    if (tabParam === 'reports' && hasReports) {
      setCurrentTab(3); // Index de l'onglet Rapports
    }
  }, [location.search, hasReports]);

  // Modifier l'effet de chargement des missions
  useEffect(() => {
    const fetchUserMissions = async () => {
      if (!currentUser?.uid) return;

      try {
        setIsLoading(true);
        setError(null);
        
        // Récupérer les candidatures acceptées de l'étudiant
        const applicationsRef = collection(db, 'applications');
        const q = query(
          applicationsRef,
          where('userId', '==', currentUser.uid),
          where('status', '==', 'Acceptée')
        );
        
        const applicationsSnapshot = await getDocs(q);
        
        if (applicationsSnapshot.empty) {
          setApplications([]);
          return;
        }

        // Pour chaque candidature, récupérer les détails de la mission OU de la tâche de recrutement
        const applicationsWithMissions = await Promise.all(
          applicationsSnapshot.docs.map(async (docSnapshot) => {
            const applicationData = docSnapshot.data();
            
            try {
              // 1) Tenter comme mission classique
              const missionDoc = await getDoc(doc(db, 'missions', applicationData.missionId));
              if (missionDoc.exists()) {
                const missionData = missionDoc.data();
                return {
                  id: docSnapshot.id,
                  ...applicationData,
                  createdAt: applicationData.createdAt?.toDate(),
                  updatedAt: applicationData.updatedAt?.toDate(),
                  mission: missionData ? {
                    id: missionDoc.id,
                    ...missionData
                  } : null
                } as Application;
              }

              // 2) Sinon, tenter comme tâche de recrutement (étude publiée)
              const taskDoc = await getDoc(doc(db, 'recruitmentTasks', applicationData.missionId));
              if (taskDoc.exists()) {
                const taskData: any = taskDoc.data();

                // Essayer de récupérer le numéro d'étude lié
                let numeroEtude: string | undefined = undefined;
                if (taskData.etudeId) {
                  try {
                    const etudeDoc = await getDoc(doc(db, 'etudes', taskData.etudeId));
                    if (etudeDoc.exists()) {
                      const etudeData: any = etudeDoc.data();
                      numeroEtude = etudeData?.numeroEtude;
                    }
                  } catch {}
                }

                // Adapter au format "Mission" local utilisé par l'UI de Profile.tsx
                const adaptedMission = {
                  id: taskDoc.id,
                  numeroMission: numeroEtude || `RT-${taskDoc.id.slice(-6)}`,
                  company: taskData.company || 'Étude',
                  location: taskData.location || 'À définir',
                  startDate: taskData.startDate || '',
                  endDate: taskData.endDate || '',
                  description: taskData.description || '',
                  title: taskData.title || 'Tâche de recrutement',
                  hours: taskData.duration || 0,
                  etape: 'Recrutement',
                  chargeId: taskData.chargeId || '',
                  chargeName: taskData.chargeName || 'Non assigné'
                } as Mission;

                return {
                  id: docSnapshot.id,
                  ...applicationData,
                  createdAt: applicationData.createdAt?.toDate(),
                  updatedAt: applicationData.updatedAt?.toDate(),
                  mission: adaptedMission
                } as Application;
              }

              console.warn(`Mission/Étude ${applicationData.missionId} introuvable`);
              return null;
            } catch (error) {
              console.error(`Error fetching mission/study ${applicationData.missionId}:`, error);
              return null;
            }
          })
        );

        // Filtrer les applications nulles (missions non trouvées)
        const validApplications = applicationsWithMissions.filter((app): app is Application => app !== null);
        setApplications(validApplications);
      } catch (error) {
        console.error('Erreur lors du chargement des missions:', error);
        setError('Erreur lors du chargement des missions');
      } finally {
        setIsLoading(false);
      }
    };

    if (currentTab === 1) {
      fetchUserMissions();
    }
  }, [currentUser, currentTab]);

  // Charger les programmes de la structure de l'utilisateur
  useEffect(() => {
    const fetchPrograms = async () => {
      if (!profileData?.structureId) return;
      try {
        const programsDoc = await getDoc(doc(db, 'programs', profileData.structureId));
        if (programsDoc.exists()) {
          const data = programsDoc.data();
          setPrograms(data.programs || []);
        } else {
          setPrograms([]);
        }
      } catch (error) {
        setPrograms([]);
      }
    };
    fetchPrograms();
  }, [profileData?.structureId]);

  // Ajouter après les autres useEffect
  useEffect(() => {
    const fetchExpenseNotes = async () => {
      if (!currentUser?.uid || currentTab !== 1) return;

      try {
        const expensesRef = collection(db, 'expenseNotes');
        const q = query(
          expensesRef,
          where('userId', '==', currentUser.uid),
          where('missionId', 'in', applications.map(app => app.mission?.id).filter(Boolean))
        );
        
        const snapshot = await getDocs(q);
        const expensesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate()
        })) as ExpenseNote[];
        
        setExpenseNotes(expensesData);
      } catch (error) {
        console.error('Erreur lors du chargement des notes de frais:', error);
      }
    };

    if (applications.length > 0) {
      fetchExpenseNotes();
    }
  }, [currentUser, applications, currentTab]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    
    // Si l'utilisateur change vers l'onglet des rapports, actualiser les données
    if (newValue === 3) {
      fetchUserReports();
    }
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
      
      setNewCV(file);
      setError(null);
    }
  };

  const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      
      // Vérifier le type de fichier
      if (!file.type.startsWith('image/')) {
        setError('Le fichier doit être une image');
        return;
      }
      
      // Vérifier la taille du fichier (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        setError('L\'image ne doit pas dépasser 2MB');
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Upload de la nouvelle photo
        const photoURL = await uploadProfilePicture(file, currentUser!.uid);
        
        // Mise à jour du profil Firebase Auth
        await updateProfile(auth.currentUser!, {
          photoURL: photoURL
        });

        // Mise à jour des données du profil
        const updatedData = {
          ...profileData,
          photoURL,
          updatedAt: new Date()
        };

        await updateUserDocument(currentUser!.uid, updatedData);
        
        // Ajouter une entrée dans l'historique
        const historyRef = collection(db, 'history');
        await addDoc(historyRef, {
          userId: currentUser!.uid,
          date: new Date().toISOString(),
          action: 'Téléchargement de la photo de profil',
          details: `Nouvelle photo de profil téléchargée par ${currentUser!.displayName || currentUser!.email}`,
          type: 'profile'
        });
        
        setProfileData(updatedData);
        setSuccess('Photo de profil mise à jour avec succès');
      } catch (error) {
        console.error('Erreur lors de la mise à jour de la photo de profil:', error);
        setError('Erreur lors de la mise à jour de la photo de profil');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (field: keyof ExtendedUserData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (profileData) {
      let value = event.target.value;
      
      // Validation pour n'accepter que les chiffres et limiter la longueur
      if (field === 'socialSecurityNumber') {
        const numericValue = value.replace(/\D/g, '');
        if (numericValue.length <= 15) {
          value = numericValue;
        } else {
          return; // Ne pas mettre à jour si plus de 15 chiffres
        }
      } else if (field === 'phone') {
        const numericValue = value.replace(/\D/g, '');
        if (numericValue.length <= 10) {
          value = numericValue;
        } else {
          return; // Ne pas mettre à jour si plus de 10 chiffres
        }
      }

      setProfileData({
        ...profileData,
        [field]: value
      });
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      setError("Vous devez être connecté pour mettre à jour votre profil");
      return;
    }

    // Validation des champs
    let hasErrors = false;
    const newValidationErrors: Record<string, boolean> = {};

    // Validation du numéro de sécurité sociale (15 chiffres)
    if (profileData.socialSecurityNumber && !/^\d{15}$/.test(profileData.socialSecurityNumber)) {
      newValidationErrors.socialSecurityNumber = true;
      hasErrors = true;
    }

    // Validation du numéro de téléphone (10 chiffres)
    if (profileData.phone && profileData.phone.length !== 10) {
      newValidationErrors.phone = true;
      hasErrors = true;
    }

    // S'il y a des erreurs, les afficher et ne pas sauvegarder
    if (hasErrors) {
      setValidationErrors(newValidationErrors);
      setError("Veuillez corriger les champs en erreur");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setValidationErrors({});
      
      let cvUrl = profileData.cvUrl;
      let photoURL = profileData.photoURL;
      let cvUploaded = false;
      let photoUploaded = false;
      
      if (newCV) {
        try {
          cvUrl = await uploadCV(newCV, currentUser.uid);
          cvUploaded = true;
        } catch (error) {
          console.error('Erreur lors du téléchargement du CV:', error);
          setError("Erreur lors du téléchargement du CV");
          return;
        }
      }

      if (newProfilePicture) {
        try {
          photoURL = await uploadProfilePicture(newProfilePicture, currentUser.uid);
          photoUploaded = true;
          // Mettre à jour le profil Firebase Auth
          await updateProfile(auth.currentUser!, {
            photoURL: photoURL
          });
        } catch (error) {
          console.error('Erreur lors du téléchargement de la photo:', error);
          setError("Erreur lors du téléchargement de la photo de profil");
          return;
        }
      }

      const updatedData = {
        ...profileData,
        cvUrl,
        photoURL,
        updatedAt: new Date()
      };

      console.log('Tentative de mise à jour du profil avec les données:', updatedData);
      await updateUserDocument(currentUser.uid, updatedData);
      console.log('Mise à jour du profil réussie');
      
      // Ajouter une entrée dans l'historique
      const historyRef = collection(db, 'history');
      
      try {
        // Si un CV a été téléchargé, ajouter une entrée spécifique
        if (cvUploaded) {
          await addDoc(historyRef, {
            userId: currentUser.uid,
            date: new Date().toISOString(),
            action: 'Téléchargement du CV',
            details: `Nouveau CV téléchargé par ${currentUser.displayName || currentUser.email}`,
            type: 'document'
          });
        }
        
        // Si une photo a été téléchargée, ajouter une entrée spécifique
        if (photoUploaded) {
          await addDoc(historyRef, {
            userId: currentUser.uid,
            date: new Date().toISOString(),
            action: 'Téléchargement de la photo de profil',
            details: `Nouvelle photo de profil téléchargée par ${currentUser.displayName || currentUser.email}`,
            type: 'profile'
          });
        }
        
        // Ajouter une entrée pour la modification du profil
        await addDoc(historyRef, {
          userId: currentUser.uid,
          date: new Date().toISOString(),
          action: 'Modification du profil',
          details: `Profil mis à jour par ${currentUser.displayName || currentUser.email}`,
          type: 'profile'
        });
      } catch (error) {
        console.error('Erreur lors de l\'ajout dans l\'historique:', error);
        // Ne pas bloquer la mise à jour du profil si l'historique échoue
      }
      
      setProfileData(updatedData);
      setSuccess('Profil mis à jour avec succès');
      setIsEditing(false);
      setNewCV(null);
      setNewProfilePicture(null);
    } catch (error) {
      console.error('Erreur détaillée lors de la mise à jour:', error);
      setError('Erreur lors de la mise à jour du profil. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = (url: string) => {
    if (!url || url.trim() === '') {
      setError('URL du CV invalide');
      return;
    }
    setPreviewUrl(url);
    setOpenPreview(true);
  };

  // Calcul du pourcentage de complétion du profil
  const calculateCompletion = (data: ExtendedUserData) => {
    const requiredFields = [
      { name: 'firstName', filled: !!data.firstName },
      { name: 'lastName', filled: !!data.lastName },
      { name: 'birthDate', filled: !!data.birthDate },
      { name: 'email', filled: !!data.email },
      { name: 'graduationYear', filled: !!data.graduationYear },
      { name: 'program', filled: !!data.program },
      { name: 'birthPlace', filled: !!data.birthPlace },
      { name: 'postalCode', filled: !!data.postalCode },
      { name: 'gender', filled: !!data.gender },
      { name: 'nationality', filled: !!data.nationality },
      { name: 'studentId', filled: !!data.studentId },
      { name: 'address', filled: !!data.address },
      { name: 'socialSecurityNumber', filled: !!data.socialSecurityNumber },
      { name: 'phone', filled: !!data.phone },
      { name: 'cvUrl', filled: !!data.cvUrl }
    ];

    const filledFields = requiredFields.filter(field => field.filled);
    return Math.round((filledFields.length / requiredFields.length) * 100);
  };

  // Ajoutez cette fonction pour gérer la suppression du CV
  const handleDeleteCV = async () => {
    if (!currentUser?.uid) return;
    
    try {
      setIsLoading(true);
      setError(null);

      // Supprimer le fichier du storage si une URL existe
      if (profileData?.cvUrl) {
        try {
          // Extraire le chemin du fichier à partir de l'URL
          const url = new URL(profileData.cvUrl);
          const pathSegments = url.pathname.split('/');
          const storagePath = pathSegments.slice(pathSegments.indexOf('o') + 1).join('/');
          
          if (storagePath) {
            const storageRef = ref(storage, decodeURIComponent(storagePath));
            await deleteObject(storageRef);
            console.log('Fichier supprimé du storage:', storagePath);
          }
        } catch (error: any) {
          // Si le fichier n'existe pas, ce n'est pas grave, on continue
          if (error.code === 'storage/object-not-found') {
            console.log('Le fichier n\'existe plus dans le storage, on continue...');
          } else {
            console.error('Erreur lors de la suppression du fichier du storage:', error);
          }
          // Continuer même si la suppression du fichier échoue
        }
      }

      const updatedData = {
        ...profileData,
        cvUrl: null,
        updatedAt: new Date()
      };

      console.log('Tentative de mise à jour avec cvUrl: null');
      await updateUserDocument(currentUser.uid, updatedData);
      console.log('Mise à jour Firestore réussie');
      
      // Ajouter une entrée dans l'historique
      const historyRef = collection(db, 'history');
      await addDoc(historyRef, {
        userId: currentUser.uid,
        date: new Date().toISOString(),
        action: 'Suppression du CV',
        details: `CV supprimé par ${currentUser.displayName || currentUser.email}`,
        type: 'document'
      });
      
      // Mettre à jour l'état local avec les nouvelles données
      setProfileData(prevData => ({
        ...prevData,
        cvUrl: null,
        updatedAt: new Date()
      }));
      
      // Fermer la prévisualisation si elle était ouverte
      setOpenPreview(false);
      setPreviewUrl(null);
      
      // Forcer la relecture des données depuis Firestore pour s'assurer de la synchronisation
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const freshData = userDoc.data() as ExtendedUserData;
          setProfileData(freshData);
        }
      } catch (error) {
        console.error('Erreur lors de la relecture des données:', error);
      }
      
      setSuccess('CV supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression du CV:', error);
      setError('Erreur lors de la suppression du CV');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !currentUser) return;
    
    const file = event.target.files[0];
    
    console.log('Fichier sélectionné:', {
      name: file.name,
      type: file.type,
      size: file.size
    });
    
    // Vérifier le type de fichier
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setError('Le fichier doit être au format PDF ou Word (.doc, .docx)');
      return;
    }
    
    // Vérifier la taille du fichier (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Le fichier est trop volumineux. Taille maximale: 5MB');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Début de l\'upload du CV pour l\'utilisateur:', currentUser.uid);
      
      // Upload du CV
      const cvUrl = await uploadCV(file, currentUser.uid);
      
      console.log('CV uploadé avec succès, URL:', cvUrl);
      
      // Mise à jour du profil avec la nouvelle URL du CV
      const updatedData = {
        ...profileData,
        cvUrl,
        updatedAt: new Date()
      };

      console.log('Mise à jour du profil avec les données:', updatedData);
      await updateUserDocument(currentUser.uid, updatedData);
      
      // Ajouter une entrée dans l'historique
      const historyRef = collection(db, 'history');
      await addDoc(historyRef, {
        userId: currentUser.uid,
        date: new Date().toISOString(),
        action: 'Téléchargement du CV',
        details: `Nouveau CV téléchargé par ${currentUser.displayName || currentUser.email}`,
        type: 'document'
      });
      
      setProfileData(updatedData);
      setSuccess('CV téléchargé avec succès');
      
      console.log('CV téléchargé et profil mis à jour avec succès');
    } catch (error) {
      console.error('Erreur lors du téléchargement du CV:', error);
      setError('Erreur lors du téléchargement du CV. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour marquer une notification comme lue
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true
      });

      // Mettre à jour l'état local
      setNotifications(prevNotifications =>
        prevNotifications.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );
      setUnreadNotifications(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la notification:', error);
    }
  };

  // Fonction pour soumettre une réponse à un rapport
  const handleResponseSubmit = async (reportId: string): Promise<void> => {
    if (!currentUser?.uid || !responseText[reportId]) return;
    
    try {
      setIsLoading(true);
      
      const reportRef = doc(db, 'reports', reportId);
      
      // Récupérer le rapport actuel pour obtenir les réponses existantes
      const reportDoc = await getDoc(reportRef);
      const reportData = reportDoc.data();
      
      // Créer un tableau de réponses ou utiliser celui existant
      const responses = reportData?.responses || [];
      
      // Ajouter la nouvelle réponse avec un horodatage côté client
      responses.push({
        text: responseText[reportId],
        timestamp: new Date().toISOString(),
        author: currentUser.email || 'Utilisateur'
      });
      
      // Mettre à jour le document avec la nouvelle réponse
      await updateDoc(reportRef, {
        responses: responses,
        updatedAt: serverTimestamp()
      });

      // Mettre à jour l'état local
      setUserReports(prevReports =>
        prevReports.map(report =>
          report.id === reportId
            ? { 
                ...report, 
                responses: responses
              }
            : report
        )
      );

      // Déterminer à qui envoyer la notification
      let notificationUserId = 'superadmin'; // Par défaut, envoyer au super admin
      
      // Si des réponses existent déjà, envoyer la notification à l'auteur de la dernière réponse
      if (responses.length > 1) {
        // La dernière réponse avant celle qu'on vient d'ajouter
        const lastResponse = responses[responses.length - 2];
        
        // Si l'auteur est le super admin, utiliser l'ID 'superadmin'
        if (lastResponse.author.includes('Super Admin')) {
          notificationUserId = 'superadmin';
        } else {
          // Sinon, chercher l'ID de l'utilisateur par son email
          try {
            const usersQuery = query(
              collection(db, 'users'),
              where('email', '==', lastResponse.author)
            );
            const usersSnapshot = await getDocs(usersQuery);
            
            if (!usersSnapshot.empty) {
              notificationUserId = usersSnapshot.docs[0].id;
            }
          } catch (error) {
            console.error('Erreur lors de la recherche de l\'utilisateur:', error);
          }
        }
      }

      // Créer une notification pour l'auteur du message auquel on répond
      await addDoc(collection(db, 'notifications'), {
        userId: notificationUserId,
        type: 'report_response',
        title: 'Nouvelle réponse à votre message',
        message: `L'utilisateur a répondu à votre message concernant son ${reportData?.type === 'bug' ? 'rapport d\'erreur' : 'idée'}`,
        read: false,
        createdAt: serverTimestamp(),
        reportId: reportId
      });

      // Réinitialiser le champ de réponse
      setShowResponseInput(prev => ({ ...prev, [reportId]: false }));
      setResponseText(prev => ({ ...prev, [reportId]: '' }));
      
      setSuccess('Réponse enregistrée avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la réponse:', error);
      setError('Erreur lors de l\'enregistrement de la réponse');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async (missionId: string) => {
    if (!currentUser?.uid || !newExpense.description || newExpense.amount <= 0) return;

    try {
      setIsLoading(true);
      
      let attachmentUrl = '';
      if (selectedFile) {
        try {
          attachmentUrl = await uploadExpenseAttachment(selectedFile, currentUser.uid, missionId);
        } catch (error) {
          setError('Erreur lors de l\'upload du justificatif');
          return;
        }
      }

      const expenseData: Omit<ExpenseNote, 'id'> = {
        missionId,
        userId: currentUser.uid,
        amount: newExpense.amount,
        description: newExpense.description,
        date: new Date(newExpense.date),
        status: 'En attente',
        attachmentUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'expenseNotes'), expenseData);
      
      setExpenseNotes(prev => [...prev, { id: docRef.id, ...expenseData }]);
      setIsAddingExpense(false);
      setNewExpense({
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
      setSelectedFile(null);
      setSuccess('Note de frais ajoutée avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la note de frais:', error);
      setError('Erreur lors de l\'ajout de la note de frais');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditExpense = async (expenseId: string) => {
    if (!currentUser?.uid) return;

    try {
      setIsLoading(true);
      const expense = expenseNotes.find(note => note.id === expenseId);
      if (!expense) return;

      let attachmentUrl = expense.attachmentUrl;
      if (selectedFile) {
        try {
          attachmentUrl = await uploadExpenseAttachment(selectedFile, currentUser.uid, expense.missionId);
        } catch (error) {
          setError('Erreur lors de l\'upload du justificatif');
          return;
        }
      }

      const updatedExpense = {
        description: editedExpense.description,
        amount: editedExpense.amount,
        date: new Date(editedExpense.date),
        attachmentUrl,
        updatedAt: new Date()
      };

      const expenseRef = doc(db, 'expenseNotes', expenseId);
      await updateDoc(expenseRef, updatedExpense);

      setExpenseNotes(prev => prev.map(note => 
        note.id === expenseId 
          ? { ...note, ...updatedExpense }
          : note
      ));

      setEditingExpenseId(null);
      setSelectedFile(null);
      setSuccess('Note de frais modifiée avec succès');
    } catch (error) {
      console.error('Erreur lors de la modification de la note de frais:', error);
      setError('Erreur lors de la modification de la note de frais');
    } finally {
      setIsLoading(false);
    }
  };

  // Ajouter cette nouvelle fonction après handleEditExpense
  const handleDeleteExpense = async (expenseId: string) => {
    if (!currentUser?.uid) return;

    try {
      setIsLoading(true);
      const expense = expenseNotes.find(note => note.id === expenseId);
      if (!expense) return;

      // Si un justificatif existe, le supprimer de Storage
      if (expense.attachmentUrl) {
        const storageRef = ref(storage, expense.attachmentUrl);
        try {
          await deleteObject(storageRef);
        } catch (error) {
          console.error('Erreur lors de la suppression du justificatif:', error);
        }
      }

      // Supprimer la note de frais de Firestore
      const expenseRef = doc(db, 'expenseNotes', expenseId);
      await deleteDoc(expenseRef);

      // Mettre à jour l'état local
      setExpenseNotes(prev => prev.filter(note => note.id !== expenseId));
      setEditingExpenseId(null);
      setSelectedFile(null);
      setSuccess('Note de frais supprimée avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression de la note de frais:', error);
      setError('Erreur lors de la suppression de la note de frais');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;

    if (window.confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) {
      try {
        setIsLoading(true);
        
        // Supprimer les données de l'utilisateur dans Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        await deleteDoc(userRef);

        // Supprimer le compte Firebase Auth
        await currentUser.delete();

        // Rediriger vers la page de connexion
        navigate('/login');
      } catch (error) {
        console.error('Erreur lors de la suppression du compte:', error);
        setError('Erreur lors de la suppression du compte');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Fonction pour envoyer une réponse à un rapport
  const handleSendResponse = async (reportId: string, response: string) => {
    if (!currentUser?.uid || !response.trim()) return;

    try {
      // Ajouter la réponse au rapport
      const reportRef = doc(db, 'reports', reportId);
      await updateDoc(reportRef, {
        responses: arrayUnion({
          userId: currentUser.uid,
          userEmail: currentUser.email,
          content: response,
          createdAt: serverTimestamp()
        }),
        status: 'responded'
      });

      // Déterminer à qui envoyer la notification
      let notificationUserId = 'superadmin'; // Par défaut, envoyer au super admin

      // Récupérer le rapport pour connaître l'auteur
      const reportDoc = await getDoc(reportRef);
      if (reportDoc.exists()) {
        const reportData = reportDoc.data();
        const responses = reportData.responses || [];

        // Si des réponses existent déjà, envoyer la notification à l'auteur de la dernière réponse
        if (responses.length > 1) {
          const lastResponse = responses[responses.length - 2]; // Avant la réponse actuelle
          if (lastResponse.userId !== currentUser.uid) {
            notificationUserId = lastResponse.userId;
          } else {
            notificationUserId = 'superadmin';
          }
        } else {
          // Première réponse, envoyer à l'auteur du rapport
          const usersSnapshot = await getDocs(
            query(collection(db, 'users'), where('email', '==', reportData.userEmail), limit(1))
          );
          if (!usersSnapshot.empty) {
            notificationUserId = usersSnapshot.docs[0].id;
          } else {
            notificationUserId = 'superadmin';
          }
        }

        // Créer une notification pour l'auteur du message auquel on répond
        await sendNotification({
          userId: notificationUserId,
          type: 'report_response',
          title: 'Nouvelle réponse à votre rapport',
          message: `Une réponse a été ajoutée à votre rapport "${reportData?.content?.substring(0, 50)}..."`,
          priority: 'medium',
          reportId
        });
      }

      // Rafraîchir les rapports
      fetchUserReports();
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la réponse:', error);
    }
  };

  if (authLoading || localLoading) {
    console.log('Profile - Affichage du loader');
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={60} />
        <Typography variant="body1" color="text.secondary">
          Chargement du profil...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    console.log('Profile - Non authentifié, retour null');
    return null;
  }

  if (!profileData) {
    console.log('Profile - Données de profil non disponibles');
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={60} />
        <Typography variant="body1" color="text.secondary">
          Chargement des données du profil...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      maxWidth: '1200px',
      width: '100%',
      margin: '0 auto',
      height: '100%',
      pb: 4
    }}>
      {/* Affichage de l'alerte selon le pourcentage de complétion */}
      {profileData && calculateCompletion(profileData) === 100 ? (
        <Alert 
          severity="success" 
          sx={{ mb: 2 }}
        >
          Profil complété, vous pouvez postuler aux missions
        </Alert>
      ) : (
        showCompletion && profileData?.profileCompletion !== 100 && (
          <Alert 
            severity="info" 
            sx={{ mb: 2 }}
            onClose={() => setShowCompletion(false)}
          >
            Votre profil est complété à {calculateCompletion(profileData)}%. Complétez vos informations pour pouvoir postuler aux missions.
          </Alert>
        )
      )}

      <Paper sx={{ 
        borderRadius: '12px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        border: '1px solid rgba(0,0,0,0.05)'
      }}>
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
        }}>
          <Tabs 
            value={currentTab} 
            onChange={(e, newValue) => setCurrentTab(newValue)}
            sx={{ px: 2 }}
          >
            <Tab label="Mes informations" />
            <Tab label="Mes missions" />
            <Tab label="Mes documents" />
            {hasReports && <Tab label="Mes rapports" />}
          </Tabs>
        </Box>

        <Box sx={{ 
          flex: 1,
          overflow: 'auto',
          p: 4,
        }}>
          {currentTab === 0 && (
            <>
              {success && (
                <Alert 
                  severity="success" 
                  sx={{ 
                    mb: 4,
                    borderRadius: 1
                  }}
                >
                  Profil mis à jour avec succès
                </Alert>
              )}

              {/* Indicateur de cotisation */}
              {profileData?.hasActiveSubscription && (
                <Alert 
                  severity="success" 
                  sx={{ 
                    mb: 4,
                    borderRadius: 1,
                    maxWidth: '400px',
                    width: '100%'
                  }}
                >
                  Cotisation active
                </Alert>
              )}

              {/* Indicateur de cotisation expirée ou inexistante */}
              {!profileData?.hasActiveSubscription && (
                <Alert 
                  severity="warning" 
                  sx={{ 
                    mb: 4,
                    borderRadius: 1,
                    maxWidth: '400px',
                    width: '100%'
                  }}
                  action={
                    <Button
                      variant="contained"
                      size="small"
                      sx={{ 
                        bgcolor: 'warning.main',
                        '&:hover': {
                          bgcolor: 'warning.dark'
                        }
                      }}
                      onClick={() => navigate('/available-missions')}
                    >
                      Payer ma cotisation
                    </Button>
                  }
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Cotisation requise ⚠️
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    Vous devez payer votre cotisation pour accéder aux missions
                  </Typography>
                </Alert>
              )}

              {/* Photo de profil */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                mb: 4,
                mt: 2,
                position: 'relative'
              }}>
                <Box sx={{ 
                  position: 'relative',
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  bgcolor: '#f5f5f7',
                  border: '1px solid rgba(0,0,0,0.1)',
                  '&:hover': {
                    '& .overlay': {
                      opacity: 1
                    }
                  }
                }}>
                  {profileData?.photoURL ? (
                    <img 
                      src={profileData.photoURL} 
                      alt="Photo de profil"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <Box sx={{ 
                      width: '100%', 
                      height: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      bgcolor: '#f5f5f7'
                    }}>
                      <Typography variant="h4" color="text.secondary">
                        {profileData?.firstName?.[0]}{profileData?.lastName?.[0]}
                      </Typography>
                    </Box>
                  )}
                  <Box 
                    className="overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      bgcolor: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s ease-in-out',
                      cursor: 'pointer'
                    }}
                    onClick={() => document.getElementById('profile-picture-input')?.click()}
                  >
                    <CloudUploadIcon sx={{ color: 'white' }} />
                  </Box>
                </Box>
                <input
                  id="profile-picture-input"
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleProfilePictureChange}
                />
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ 
                    mt: 1,
                    cursor: 'pointer',
                    '&:hover': {
                      color: 'primary.main'
                    }
                  }}
                  onClick={() => document.getElementById('profile-picture-input')?.click()}
                >
                  {profileData?.photoURL ? 'Modifier la photo' : 'Ajouter une photo'}
                </Typography>
              </Box>

              <Box sx={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 6,
                mb: 4
              }}>
                <Box>
                  <Typography 
                    variant="h6" 
                    color="text.secondary" 
                    gutterBottom
                    sx={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      mb: 3
                    }}
                  >
                    Informations personnelles
                  </Typography>
                  <Stack spacing={3}>
                    <TextField
                      fullWidth
                      label="Prénom"
                      value={profileData?.firstName || ''}
                      onChange={handleInputChange('firstName')}
                      disabled={!isEditing}
                      size="small"
                      required
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        readOnly: !isEditing,
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            Prénom
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Nom"
                      value={profileData?.lastName || ''}
                      onChange={handleInputChange('lastName')}
                      disabled={!isEditing}
                      size="small"
                      required
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        readOnly: !isEditing,
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            Nom
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Date de naissance"
                      type="date"
                      value={profileData?.birthDate || ''}
                      onChange={handleInputChange('birthDate')}
                      disabled={!isEditing}
                      size="small"
                      required
                      sx={{
                        ...textFieldStyles,
                        '& input[type="date"]::-webkit-calendar-picker-indicator': {
                          filter: 'invert(0.5)',
                        },
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            Date de naissance
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: true,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Lieu de naissance"
                      value={profileData?.birthPlace || ''}
                      onChange={handleInputChange('birthPlace')}
                      disabled={!isEditing}
                      size="small"
                      required
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            Lieu de naissance
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Code postal de naissance"
                      value={profileData?.postalCode || ''}
                      onChange={handleInputChange('postalCode')}
                      disabled={!isEditing}
                      size="small"
                      required
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            Code postal de naissance
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                    <TextField
                      select
                      fullWidth
                      label="Sexe"
                      value={profileData?.gender || ''}
                      onChange={handleInputChange('gender')}
                      disabled={!isEditing}
                      size="small"
                      required
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            Sexe
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                      SelectProps={{
                        MenuProps: {
                          PaperProps: {
                            sx: {
                              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                              borderRadius: '8px',
                            }
                          }
                        }
                      }}
                    >
                      <MenuItem value="M">Homme</MenuItem>
                      <MenuItem value="F">Femme</MenuItem>
                      <MenuItem value="Autre">Autre</MenuItem>
                    </TextField>
                    <TextField
                      fullWidth
                      label="Nationalité"
                      value={profileData?.nationality || ''}
                      onChange={handleInputChange('nationality')}
                      disabled={!isEditing}
                      size="small"
                      required
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            Nationalité
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                  </Stack>
                </Box>

                <Box>
                  <Typography 
                    variant="h6" 
                    color="text.secondary" 
                    gutterBottom
                    sx={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      mb: 3
                    }}
                  >
                    Informations académiques et contact
                  </Typography>
                  <Stack spacing={3}>
                    <TextField
                      fullWidth
                      label="Email académique"
                      value={profileData?.email || ''}
                      onChange={handleInputChange('email')}
                      disabled
                      size="small"
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        readOnly: true,
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            Email académique
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="N° étudiant"
                      value={profileData?.studentId || ''}
                      onChange={handleInputChange('studentId')}
                      disabled={!isEditing}
                      size="small"
                      required
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        readOnly: !isEditing,
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            N° étudiant
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                    <FormControl fullWidth required disabled={!isEditing} sx={{ ...textFieldStyles }}>
                      <InputLabel id="program-label">Programme</InputLabel>
                      <Select
                        labelId="program-label"
                        id="program"
                        value={profileData?.program || ''}
                        label="Programme"
                        onChange={e => handleInputChange('program')(e as any)}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                              borderRadius: '8px',
                            }
                          }
                        }}
                      >
                        {programs.length > 0 ? (
                          programs.map((program) => (
                            <MenuItem key={program} value={program}>{program}</MenuItem>
                          ))
                        ) : (
                          <MenuItem disabled value="">
                            {profileData?.structureId ? 'Aucun programme' : 'Aucune structure'}
                          </MenuItem>
                        )}
                      </Select>
                      {!profileData?.structureId && (
                        <FormHelperText>Veuillez d'abord renseigner votre structure</FormHelperText>
                      )}
                    </FormControl>
                    <TextField
                      fullWidth
                      label="Année d'étude"
                      value={profileData?.graduationYear || ''}
                      onChange={handleInputChange('graduationYear')}
                      disabled={!isEditing}
                      size="small"
                      required
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        readOnly: !isEditing,
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            Année d'étude
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Adresse"
                      value={profileData?.address || ''}
                      onChange={handleInputChange('address')}
                      disabled={!isEditing}
                      multiline
                      rows={2}
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        readOnly: !isEditing,
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            Adresse
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="N° de sécurité sociale"
                      value={profileData?.socialSecurityNumber || ''}
                      onChange={handleInputChange('socialSecurityNumber')}
                      disabled={!isEditing}
                      size="small"
                      required
                      error={validationErrors.socialSecurityNumber}
                      helperText={validationErrors.socialSecurityNumber ? 
                        "15 chiffres requis" : ""}
                      inputProps={{
                        maxLength: 15
                      }}
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        readOnly: !isEditing,
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            N° de sécurité sociale
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="N° de téléphone"
                      value={profileData?.phone || ''}
                      onChange={handleInputChange('phone')}
                      disabled={!isEditing}
                      size="small"
                      required
                      error={validationErrors.phone}
                      helperText={validationErrors.phone ? 
                        "10 chiffres requis" : ""}
                      inputProps={{
                        maxLength: 10
                      }}
                      sx={{
                        ...textFieldStyles,
                        '& .MuiInputBase-root': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                          padding: '10px 14px',
                          flex: 1
                        }
                      }}
                      InputProps={{
                        readOnly: !isEditing,
                        startAdornment: isEditing ? null : (
                          <Box sx={inputLabelStyle}>
                            N° de téléphone
                          </Box>
                        ),
                      }}
                      InputLabelProps={{
                        shrink: isEditing,
                        sx: { display: isEditing ? 'block' : 'none' }
                      }}
                    />
                  </Stack>
                </Box>
              </Box>

              <Box sx={{ 
                position: 'sticky',
                bottom: 0,
                pb: 4,
                pt: 2,
                bgcolor: 'background.paper',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                {isEditing && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleDeleteAccount}
                    disabled={isLoading}
                    startIcon={<DeleteIcon />}
                  >
                    Supprimer mon compte
                  </Button>
                )}
                <Button
                  variant="contained"
                  startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
                  onClick={isEditing ? handleSave : () => setIsEditing(true)}
                  disabled={isLoading}
                >
                  {isEditing ? 'Enregistrer' : 'Modifier'}
                </Button>
              </Box>
            </>
          )}

          {currentTab === 1 && (
            <Box sx={{ p: 0 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                Mes missions en cours
              </Typography>
              
              {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              ) : applications.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f8f9fa' }}>
                  <Typography variant="subtitle1" color="text.secondary">
                    Vous n'avez pas encore de mission en cours
                  </Typography>
                </Paper>
              ) : (
                <Grid container spacing={3}>
                  {applications.map((application) => (
                    <Grid item xs={12} key={application.id}>
                      <Paper
                        sx={{
                          p: 3,
                          borderRadius: '12px',
                          boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                          '&:hover': {
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                            transform: 'translateY(-2px)',
                            transition: 'all 0.2s ease-in-out'
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Box>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                              Mission #{application.mission?.numeroMission || 'N/A'}
                            </Typography>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                              {application.mission?.title} • {application.mission?.company} • {application.mission?.location}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Chargé de mission : {application.mission?.chargeName || 'Non assigné'}
                            </Typography>
                          </Box>
                          <Chip
                            label={application.mission?.etape}
                            color={
                              application.mission?.etape === 'Facturation' ? 'success' :
                              application.mission?.etape === 'Audit' ? 'warning' : 'primary'
                            }
                            size="small"
                          />
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                Période :
                              </Typography>
                              <Typography variant="body2">
                                {new Date(application.mission?.startDate || '').toLocaleDateString()} - {new Date(application.mission?.endDate || '').toLocaleDateString()}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  Heures planifiées :
                                </Typography>
                                <Typography variant="body2">
                                  {calculatePlannedHours(application.workingHours).toFixed(1)}h
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>

                        <Divider sx={{ my: 2 }} />

                        {/* Section Notes de frais */}
                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 2 }}>
                            Notes de frais
                          </Typography>
                          
                          {/* Liste des notes de frais existantes */}
                          {expenseNotes
                            .filter(note => note.missionId === application.mission?.id)
                            .map((note) => (
                              <Box
                                key={note.id}
                                sx={{
                                  p: 2,
                                  mb: 1,
                                  bgcolor: '#f8f9fa',
                                  borderRadius: '8px'
                                }}
                              >
                                {editingExpenseId === note.id ? (
                                  // Mode édition
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Grid container spacing={2}>
                                      <Grid item xs={12} sm={6}>
                                        <TextField
                                          fullWidth
                                          label="Description"
                                          value={editedExpense.description}
                                          onChange={(e) => setEditedExpense(prev => ({
                                            ...prev,
                                            description: e.target.value
                                          }))}
                                          size="small"
                                        />
                                      </Grid>
                                      <Grid item xs={12} sm={3}>
                                        <TextField
                                          fullWidth
                                          label="Montant"
                                          type="number"
                                          value={editedExpense.amount}
                                          onChange={(e) => setEditedExpense(prev => ({
                                            ...prev,
                                            amount: parseFloat(e.target.value) || 0
                                          }))}
                                          size="small"
                                          InputProps={{
                                            endAdornment: <InputAdornment position="end">€</InputAdornment>
                                          }}
                                        />
                                      </Grid>
                                      <Grid item xs={12} sm={3}>
                                        <TextField
                                          fullWidth
                                          label="Date"
                                          type="date"
                                          value={editedExpense.date}
                                          onChange={(e) => setEditedExpense(prev => ({
                                            ...prev,
                                            date: e.target.value
                                          }))}
                                          size="small"
                                          InputLabelProps={{
                                            shrink: true,
                                          }}
                                        />
                                      </Grid>
                                      <Grid item xs={12}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                          <Button
                                            component="label"
                                            variant="outlined"
                                            startIcon={<CloudUploadIcon />}
                                          >
                                            {note.attachmentUrl ? 'Modifier le justificatif' : 'Ajouter un justificatif'}
                                            <input
                                              type="file"
                                              hidden
                                              accept="image/*,.pdf"
                                              onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                  const file = e.target.files[0];
                                                  
                                                  // Vérifier le type de fichier
                                                  const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'];
                                                  if (!allowedTypes.includes(file.type)) {
                                                    setError('Le justificatif doit être une image (JPG, PNG, HEIC) ou un PDF');
                                                    return;
                                                  }
                                                  
                                                  // Vérifier la taille du fichier (5MB max)
                                                  if (file.size > 5 * 1024 * 1024) {
                                                    setError('Le justificatif ne doit pas dépasser 5MB');
                                                    return;
                                                  }
                                                  
                                                  setSelectedFile(file);
                                                  setError(null);
                                                }
                                              }}
                                            />
                                          </Button>
                                          {selectedFile && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                              <Typography variant="caption" color="text.secondary">
                                                {selectedFile.name}
                                              </Typography>
                                              <IconButton
                                                size="small"
                                                onClick={() => setSelectedFile(null)}
                                                sx={{ color: '#FF3B30' }}
                                              >
                                                <DeleteIcon fontSize="small" />
                                              </IconButton>
                                            </Box>
                                          )}
                                        </Box>
                                      </Grid>
                                    </Grid>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 2 }}>
                                      <Button
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => {
                                          if (window.confirm('Êtes-vous sûr de vouloir supprimer cette note de frais ?')) {
                                            handleDeleteExpense(note.id);
                                          }
                                        }}
                                        sx={{
                                          borderColor: '#FF3B30',
                                          color: '#FF3B30',
                                          '&:hover': {
                                            borderColor: '#FF3B30',
                                            backgroundColor: 'rgba(255, 59, 48, 0.04)'
                                          }
                                        }}
                                      >
                                        Supprimer
                                      </Button>
                                      <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button
                                          onClick={() => {
                                            setEditingExpenseId(null);
                                            setSelectedFile(null);
                                          }}
                                        >
                                          Annuler
                                        </Button>
                                        <Button
                                          variant="contained"
                                          onClick={() => handleEditExpense(note.id)}
                                          disabled={!editedExpense.description || editedExpense.amount <= 0}
                                        >
                                          Enregistrer
                                        </Button>
                                      </Box>
                                    </Box>
                                  </Box>
                                ) : (
                                  // Mode affichage
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                      <Typography variant="body2">
                                        {note.description}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {note.date.toLocaleDateString()}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                      {note.attachmentUrl && (
                                        <Button
                                          size="small"
                                          startIcon={<DocIcon />}
                                          onClick={() => handlePreview(note.attachmentUrl!)}
                                          sx={{
                                            color: '#2E3B7C',
                                            '&:hover': {
                                              backgroundColor: 'rgba(46, 59, 124, 0.04)',
                                            },
                                          }}
                                        >
                                          Justificatif
                                        </Button>
                                      )}
                                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {note.amount.toFixed(2)} €
                                      </Typography>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip
                                          label={note.status}
                                          size="small"
                                          color={
                                            note.status === 'Validée' ? 'success' :
                                            note.status === 'Refusée' ? 'error' : 'default'
                                          }
                                        />
                                        {note.status === 'En attente' && (
                                          <>
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                setEditingExpenseId(note.id);
                                                setEditedExpense({
                                                  description: note.description,
                                                  amount: note.amount,
                                                  date: note.date.toISOString().split('T')[0]
                                                });
                                              }}
                                              sx={{
                                                color: '#007AFF',
                                                '&:hover': {
                                                  backgroundColor: 'rgba(0, 122, 255, 0.04)'
                                                }
                                              }}
                                            >
                                              <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              onClick={() => {
                                                if (window.confirm('Êtes-vous sûr de vouloir supprimer cette note de frais ?')) {
                                                  handleDeleteExpense(note.id);
                                                }
                                              }}
                                              sx={{
                                                color: '#FF3B30',
                                                '&:hover': {
                                                  backgroundColor: 'rgba(255, 59, 48, 0.04)'
                                                }
                                              }}
                                            >
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </>
                                        )}
                                      </Box>
                                    </Box>
                                  </Box>
                                )}
                              </Box>
                            ))}

                          {/* Formulaire d'ajout de note de frais */}
                          {isAddingExpense && application.mission?.id ? (
                            <Box sx={{ mt: 2 }}>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    fullWidth
                                    label="Description"
                                    value={newExpense.description}
                                    onChange={(e) => setNewExpense(prev => ({
                                      ...prev,
                                      description: e.target.value
                                    }))}
                                    size="small"
                                  />
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                  <TextField
                                    fullWidth
                                    label="Montant"
                                    type="number"
                                    value={newExpense.amount}
                                    onChange={(e) => setNewExpense(prev => ({
                                      ...prev,
                                      amount: parseFloat(e.target.value) || 0
                                    }))}
                                    size="small"
                                    InputProps={{
                                      endAdornment: <InputAdornment position="end">€</InputAdornment>
                                    }}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                  <TextField
                                    fullWidth
                                    label="Date"
                                    type="date"
                                    value={newExpense.date}
                                    onChange={(e) => setNewExpense(prev => ({
                                      ...prev,
                                      date: e.target.value
                                    }))}
                                    size="small"
                                    InputLabelProps={{
                                      shrink: true,
                                    }}
                                  />
                                </Grid>
                                <Grid item xs={12}>
                                  <Button
                                    component="label"
                                    variant="outlined"
                                    startIcon={<CloudUploadIcon />}
                                    sx={{ mr: 2 }}
                                  >
                                    Ajouter un justificatif
                                    <input
                                      type="file"
                                      hidden
                                      accept="image/*,.pdf"
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          const file = e.target.files[0];
                                          
                                          // Vérifier le type de fichier
                                          const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'];
                                          if (!allowedTypes.includes(file.type)) {
                                            setError('Le justificatif doit être une image (JPG, PNG, HEIC) ou un PDF');
                                            return;
                                          }
                                          
                                          // Vérifier la taille du fichier (5MB max)
                                          if (file.size > 5 * 1024 * 1024) {
                                            setError('Le justificatif ne doit pas dépasser 5MB');
                                            return;
                                          }
                                          
                                          setSelectedFile(file);
                                          setError(null);
                                        }
                                      }}
                                    />
                                  </Button>
                                  {selectedFile && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography variant="caption" color="text.secondary">
                                        {selectedFile.name}
                                      </Typography>
                                      <IconButton
                                        size="small"
                                        onClick={() => setSelectedFile(null)}
                                        sx={{ color: '#FF3B30' }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                  )}
                                </Grid>
                                <Grid item xs={12}>
                                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                    <Button
                                      onClick={() => setIsAddingExpense(false)}
                                    >
                                      Annuler
                                    </Button>
                                    <Button
                                      variant="contained"
                                      onClick={() => handleAddExpense(application.mission?.id || '')}
                                      disabled={!newExpense.description || newExpense.amount <= 0}
                                    >
                                      Ajouter
                                    </Button>
                                  </Box>
                                </Grid>
                              </Grid>
                            </Box>
                          ) : (
                            <Button
                              startIcon={<AddIcon />}
                              onClick={() => setIsAddingExpense(true)}
                              sx={{ mt: 1 }}
                            >
                              Ajouter une note de frais
                            </Button>
                          )}
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {currentTab === 2 && (
            <Box sx={{ p: 4 }}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    CV (obligatoire)
                  </Typography>
                  {profileData?.cvUrl && profileData.cvUrl.trim() !== '' ? (
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      gap: 2,
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1
                    }}>
                      <PdfIcon color="action" />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">Mon CV</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Mis à jour le {new Date().toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button 
                          size="small"
                          onClick={() => {
                            if (profileData?.cvUrl && profileData.cvUrl.trim() !== '') {
                              handlePreview(profileData.cvUrl);
                            }
                          }}
                        >
                          Voir
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={handleDeleteCV}
                          disabled={isLoading}
                          sx={{
                            '&:hover': {
                              backgroundColor: 'rgba(211, 47, 47, 0.04)',
                            },
                          }}
                        >
                          Supprimer
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<CloudUploadIcon />}
                      fullWidth
                      disabled={isLoading}
                      sx={{
                        borderColor: '#E0E0E0',
                        color: '#2E3B7C',
                        '&:hover': {
                          borderColor: '#2E3B7C',
                          backgroundColor: 'rgba(46, 59, 124, 0.04)',
                        },
                      }}
                    >
                      Ajouter un CV
                      <VisuallyHiddenInput 
                        type="file" 
                        accept=".pdf,.doc,.docx"
                        onChange={handleCVUpload}
                      />
                    </Button>
                  )}
                  {error && (
                    <Alert 
                      severity="error" 
                      sx={{ mt: 2 }}
                      onClose={() => setError(null)}
                    >
                      {error}
                    </Alert>
                  )}
                  {success && (
                    <Alert 
                      severity="success" 
                      sx={{ mt: 2 }}
                      onClose={() => setSuccess(null)}
                    >
                      {success}
                    </Alert>
                  )}
                  {isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  )}
                </Box>
              </Stack>
            </Box>
          )}

          {currentTab === 3 && hasReports && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Mes rapports et suggestions
              </Typography>
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Discussion</TableCell>
                      <TableCell>Statut</TableCell>
                      <TableCell>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {report.type === 'bug' ? (
                              <BugReportIcon color="error" />
                            ) : (
                              <LightbulbIcon color="primary" />
                            )}
                            {report.type === 'bug' ? 'Erreur' : 'Idée'}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                            {/* Message original */}
                            <Box sx={{ p: 1, bgcolor: 'white', borderRadius: 1, mb: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Vous - {report.createdAt instanceof Date 
                                  ? report.createdAt.toLocaleString()
                                  : new Date(report.createdAt).toLocaleString()}
                              </Typography>
                              <Typography variant="body2">{report.content}</Typography>
                            </Box>
                            
                            {/* Réponses existantes */}
                            {report.responses && report.responses.length > 0 && (
                              <>
                                {report.responses.map((resp, idx) => (
                                  <Box key={idx} sx={{ mt: 1, p: 1, bgcolor: 'white', borderRadius: 1 }}>
                                    <Typography variant="caption" color="text.secondary">
                                      {resp.author} - {new Date(resp.timestamp).toLocaleString()}
                                    </Typography>
                                    <Typography variant="body2">{resp.text}</Typography>
                                  </Box>
                                ))}
                              </>
                            )}
                            
                            {/* Réponse simple (pour compatibilité avec l'ancien format) */}
                            {!report.responses && report.response && (
                              <Box sx={{ mt: 1, p: 1, bgcolor: 'white', borderRadius: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Super Admin
                                </Typography>
                                <Typography variant="body2">{report.response}</Typography>
                              </Box>
                            )}
                            
                            {/* Bouton de réponse */}
                            {!showResponseInput[report.id] ? (
                              <Button
                                size="small"
                                startIcon={<ReplyIcon />}
                                onClick={() => setShowResponseInput(prev => ({ ...prev, [report.id]: true }))}
                                sx={{ mt: 1 }}
                              >
                                Répondre
                              </Button>
                            ) : (
                              <Box sx={{ mt: 1 }}>
                                <TextField
                                  fullWidth
                                  multiline
                                  rows={2}
                                  placeholder="Ajouter une réponse..."
                                  variant="outlined"
                                  size="small"
                                  value={responseText[report.id] || ''}
                                  onChange={(e) => setResponseText(prev => ({ ...prev, [report.id]: e.target.value }))}
                                />
                                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => handleSendResponse(report.id, responseText[report.id])}
                                    disabled={isLoading || !responseText[report.id]}
                                  >
                                    Envoyer
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                      setShowResponseInput(prev => ({ ...prev, [report.id]: false }));
                                      setResponseText(prev => ({ ...prev, [report.id]: '' }));
                                    }}
                                  >
                                    Annuler
                                  </Button>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              report.status === 'completed' ? 'Terminé' :
                              report.status === 'in_progress' ? 'En cours' :
                              report.status === 'rejected' ? 'Rejeté' : 'En attente'
                            }
                            color={
                              report.status === 'completed' ? 'success' :
                              report.status === 'in_progress' ? 'warning' :
                              report.status === 'rejected' ? 'error' : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {report.createdAt instanceof Date 
                            ? report.createdAt.toLocaleDateString()
                            : new Date(report.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </Paper>

      <Dialog
        open={openPreview}
        onClose={() => {
          setOpenPreview(false);
          setPreviewUrl(null);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh'
          }
        }}
      >
        <DialogContent sx={{ p: 0, height: '100%' }}>
          {previewUrl && previewUrl.trim() !== '' && (
            <iframe
              src={previewUrl}
              style={{ 
                width: '100%', 
                height: '100%', 
                border: 'none' 
              }}
              title="CV Preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
} 