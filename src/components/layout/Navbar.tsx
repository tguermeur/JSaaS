import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Box, 
  Avatar, 
  Menu, 
  MenuItem, 
  ListItemIcon, 
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  styled,
  DialogContentText,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  InputAdornment,
  Badge
} from '@mui/material';
import { 
  AccountCircle, 
  Settings, 
  Logout, 
  Person,
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  AddPhotoAlternate as AddPhotoAlternateIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  Notifications as NotificationsIcon,
  PostAdd as PostAddIcon,
  UploadFile as UploadFileIcon,
  Description as DescriptionIcon,
  History as HistoryIcon,
  Schedule as ScheduleIcon,
  HelpOutline as HelpIcon,
  Info as InfoIcon,
  School as SchoolIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStructure } from '../../hooks/useStructure';
import { useDecryptedUserName } from '../../hooks/useDecryptedUserName';
import UserNameSkeleton from '../common/UserNameSkeleton';
import { useNotifications } from '../../contexts/NotificationContext';
import { addReport } from '../../services/reportService';
import { uploadErrorImage } from '../../firebase/storage';
import { doc, getDoc, collection, query as firestoreQuery, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getUserRecentActivity } from '../../services/userActivityService';
import { decryptUsersList } from '../../utils/decryptUserUtils';
import NotificationBadge from '../ui/NotificationBadge';
import NotificationList from '../ui/NotificationList';
import { useSnackbar } from 'notistack';
import { useChangelog } from '../../contexts/ChangelogContext';
import { useFreeQuotaUpgrade } from '../../contexts/FreeQuotaUpgradeContext';
import { useStructureQuota } from '../../hooks/useStructureQuota';
import { tokens } from '../../theme/tokens';
import { useAmbassadorBranding } from '../../hooks/useAmbassadorBranding';
import { DsPill } from '../ds/SettingsPrimitives';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#ffffff',
  color: '#111827',
  boxShadow: 'none',
  borderBottom: `1px solid ${tokens.colors.borderLight}`,
  zIndex: theme.zIndex.drawer + 1,
}));

const StyledToolbar = styled(Toolbar)({
  minHeight: '48px',
  padding: '0 16px',
});

interface NavbarProps {
  // Suppression de la prop onMenuClick qui n'est plus nécessaire
}

// Interface pour les résultats de recherche
interface SearchResult {
  id: string;
  type: 'mission' | 'user' | 'company';
  title: string;
  subtitle: string;
  avatar?: string;
  icon: React.ReactNode;
  url?: string;
}

interface SearchResults {
  missions: SearchResult[];
  users: SearchResult[];
  companies: SearchResult[];
}

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

const Navbar: React.FC<NavbarProps> = () => {
  const navigate = useNavigate();
  const { currentUser, logoutUser, userData, contactPermissions, isContactWithAccess } = useAuth();
  const { fullName, initials, loading: userNameLoading } = useDecryptedUserName(
    currentUser?.uid
      ? {
          id: currentUser.uid,
          displayName: userData?.displayName ?? currentUser.displayName ?? undefined,
          firstName: userData?.firstName,
          lastName: userData?.lastName,
        }
      : null,
    currentUser?.email?.split('@')[0] ?? 'Utilisateur',
  );
  const { 
    persistentNotifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();
  const { enqueueSnackbar } = useSnackbar();
  const { openChangelog, openOnboarding, hasCompletedOnboarding, showInfoButtonHint, infoButtonHintMessage, hideInfoButtonHint, hasUnseenChangelog } = useChangelog();
  const { openFreeQuotaDialog } = useFreeQuotaUpgrade();
  const structureQuota = useStructureQuota(userData?.structureId);

  // États pour le menu utilisateur
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [infoMenuAnchorEl, setInfoMenuAnchorEl] = useState<null | HTMLElement>(null);
  const infoMenuOpen = Boolean(infoMenuAnchorEl);

  // États pour les rapports de bugs/idées
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [errorImage, setErrorImage] = useState<File | null>(null);
  const [errorImagePreview, setErrorImagePreview] = useState<string | null>(null);

  // États pour la recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults>({
    missions: [],
    users: [],
    companies: []
  });
  const [recentData, setRecentData] = useState<{
    missions: SearchResult[];
    documents: SearchResult[];
  }>({
    missions: [],
    documents: []
  });

  // États pour les notifications
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState<null | HTMLElement>(null);
  const notificationsOpen = Boolean(notificationsAnchorEl);
  const [visibleNotifications, setVisibleNotifications] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLDivElement>(null);

  // Type de structure (cache partagé avec Sidebar)
  const { structure: cachedStructure } = useStructure(userData?.structureId);
  const structureType = (cachedStructure?.structureType as 'junior' | 'jobservice' | null) || null;
  
  const isEtudiant = userData?.status === "etudiant";
  const isEntreprise = userData?.status === "entreprise";
  const isSuperAdmin = userData?.status === "superadmin";
  const isAdmin = userData?.status === "admin";
  const isMember = userData?.status === "membre";
  const isAdminStructure = userData?.status === "admin_structure";
  const isJuniorEntreprise = isAdminStructure || isAdmin || isMember || isSuperAdmin;

  const { logoLargeUrl, logoUrl, loading: companyBrandingLoading } = useAmbassadorBranding(
    userData?.structureId,
    isEntreprise ? userData?.companyId : undefined
  );
  const companyHeaderLogo = logoLargeUrl || logoUrl;
  const showCompanyHeaderLogo = isEntreprise && !companyBrandingLoading && !!companyHeaderLogo;
  
  // Permissions pour la recherche et notifications
  const canSearch = isJuniorEntreprise;
  const canSeeAmbassadorNotifications =
    isContactWithAccess &&
    (contactPermissions?.canViewEvents || contactPermissions?.canManageAmbassadors);
  const canSeeNotifications = isJuniorEntreprise || canSeeAmbassadorNotifications;
  
  // Les contacts avec accès ne peuvent pas voir le bouton "Voir les nouveautés"
  const canSeeChangelog = !isContactWithAccess;

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
    handleClose();
  };

  const handleProfile = () => {
    navigate('/app/profile');
    handleClose();
  };

  const getInitials = () => {
    if (userNameLoading) return '';
    if (initials) return initials;
    if (!currentUser?.email) return '?';
    return currentUser.email.charAt(0).toUpperCase();
  };

  const handleErrorImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!file.type.startsWith('image/')) {
        // Gérer l'erreur
        return;
      }
      setErrorImage(file);
      setErrorImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitReport = async (type: 'bug' | 'idea') => {
    if (!currentUser?.uid || !currentUser?.email) return;
    
    console.log('📝 Soumission rapport:', { type, hasImage: !!errorImage, userId: currentUser.uid });
    
    try {
      let imageUrl = null;
      
      // Traiter l'image seulement si on en a une et que c'est un bug
      if (type === 'bug' && errorImage) {
        console.log('🖼️ Traitement de l\'image d\'erreur...');
        try {
          imageUrl = await uploadErrorImage(errorImage, currentUser.uid);
          console.log('✅ Image uploadée avec succès:', imageUrl);
        } catch (storageError) {
          console.warn('⚠️ Firebase Storage non disponible, rapport envoyé sans image:', storageError);
          
          // Notification à l'utilisateur pour lui indiquer le problème
          console.log('💡 Le rapport sera envoyé sans image car Firebase Storage n\'est pas configuré correctement');
          console.log('💡 Pour résoudre : Vérifiez la configuration Firebase Storage dans la console Firebase');
          
          // On continue même si l'upload de l'image échoue
        }
      }
      
      const reportData = {
        type,
        content: reportText,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        createdAt: new Date(),
        status: 'pending',
        imageUrl: imageUrl,
        ...(userData?.structureId ? { structureId: userData.structureId } : {}),
      };

      console.log('💾 Sauvegarde du rapport:', reportData);
      await addReport(reportData);
      console.log('✅ Rapport sauvegardé avec succès');
      
      // Message de succès pour l'utilisateur avec notification élégante
      const successMessage = type === 'bug' 
        ? '🐛 Rapport de bug envoyé avec succès ! Notre équipe va l\'examiner sous peu.'
        : '💡 Suggestion d\'amélioration envoyée avec succès ! Merci pour votre contribution.';
      
      // Afficher notification avec le système existant
      enqueueSnackbar(successMessage, { 
        variant: 'success', 
        autoHideDuration: 4000,
        anchorOrigin: {
          vertical: 'top',
          horizontal: 'right',
        }
      });
      
      // Réinitialiser
      setReportText('');
      setErrorImage(null);
      setErrorImagePreview(null);
      type === 'bug' ? setBugDialogOpen(false) : setIdeaDialogOpen(false);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du rapport:', error);
    }
  };

  const fetchRecentData = async () => {
    if (!currentUser) return;
    
    try {
      // Récupérer le structureId de l'utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      const structureId = userData?.structureId;

      if (!structureId) {
        setRecentData({
          missions: [],
          documents: []
        });
        return;
      }

      const activities = await getUserRecentActivity(currentUser.uid);
      
      // Récupérer le type de structure si pas encore chargé
      const currentStructureType =
        structureType || cachedStructure?.structureType || 'jobservice';

      // Filtrer les missions/études par structureId
      const recentMissions = activities
        .filter(item => {
          if (item.type !== 'mission') return false;
          // Vérifier si la mission/étude appartient à la structure de l'utilisateur
          if (item.metadata?.structureId) {
            return item.metadata.structureId === structureId;
          }
          return true; // On laisse passer pour vérifier ensuite
        })
        .slice(0, 10) // Récupérer plus pour filtrer ensuite
        .map(item => ({
          id: item.id,
          type: 'mission' as const,
          title: item.title,
          subtitle: item.subtitle || '',
          icon: <HistoryIcon fontSize="small" />,
          metadata: item.metadata
        }));

      // Vérifier les missions/études dans Firestore pour s'assurer qu'elles appartiennent à la structure
      const verifiedMissions = await Promise.all(
        recentMissions.map(async (mission) => {
          try {
            if (currentStructureType === 'junior') {
              // Pour les JE, vérifier dans la collection 'etudes'
              const etudeDoc = await getDoc(doc(db, 'etudes', mission.id));
              if (etudeDoc.exists()) {
                const etudeData = etudeDoc.data();
                if (etudeData.structureId === structureId) {
                  return { ...mission, url: `/app/etude/${mission.id}` };
                }
              }
            } else {
              // Pour les JS, vérifier dans la collection 'missions'
              const missionDoc = await getDoc(doc(db, 'missions', mission.id));
              if (missionDoc.exists()) {
                const missionData = missionDoc.data();
                if (missionData.structureId === structureId) {
                  return mission;
                }
              }
            }
            return null;
          } catch (error) {
            console.error('Erreur lors de la vérification de la mission/étude:', error);
            return null;
          }
        })
      );

      const filteredMissions = verifiedMissions
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .slice(0, 3)
        .map(m => ({
          id: m.id,
          type: 'mission' as const,
          title: m.title,
          subtitle: m.subtitle || '',
          icon: <HistoryIcon fontSize="small" />
        }));

      // Filtrer les documents par structureId
      const recentDocuments = activities
        .filter(item => {
          if (item.type !== 'document') return false;
          // Vérifier si le document appartient à la structure de l'utilisateur
          if (item.metadata?.structureId) {
            return item.metadata.structureId === structureId;
          }
          // Si pas de metadata, on vérifie en récupérant le document depuis Firestore
          return true; // On laisse passer pour vérifier ensuite
        })
        .slice(0, 10) // Récupérer plus pour filtrer ensuite
        .map(item => ({
          id: item.id,
          type: 'mission' as const, // On utilise le type 'mission' pour la compatibilité, mais on gère l'URL spécifiquement
          title: item.title,
          subtitle: item.subtitle || '',
          icon: <DescriptionIcon fontSize="small" />,
          url: item.url,
          metadata: item.metadata
        }));

      // Vérifier les documents dans Firestore pour s'assurer qu'ils appartiennent à la structure
      // Les documents peuvent être dans 'documents' ou 'generatedDocuments'
      const verifiedDocuments = await Promise.all(
        recentDocuments.map(async (doc) => {
          try {
            // Essayer d'abord dans la collection 'documents'
            const documentDoc = await getDoc(doc(db, 'documents', doc.id));
            if (documentDoc.exists()) {
              const documentData = documentDoc.data();
              if (documentData.structureId === structureId) {
                return doc;
              }
              return null;
            }
            
            // Si pas trouvé, essayer dans 'generatedDocuments'
            const generatedDoc = await getDoc(doc(db, 'generatedDocuments', doc.id));
            if (generatedDoc.exists()) {
              const generatedData = generatedDoc.data();
              if (generatedData.structureId === structureId) {
                return doc;
              }
            }
            
            return null;
          } catch (error) {
            console.error('Erreur lors de la vérification du document:', error);
            return null;
          }
        })
      );

      const filteredDocuments = verifiedDocuments
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .slice(0, 3)
        .map(d => ({
          id: d.id,
          type: 'mission' as const,
          title: d.title,
          subtitle: d.subtitle || '',
          icon: <DescriptionIcon fontSize="small" />,
          url: d.url
        }));

      setRecentData({
        missions: filteredMissions,
        documents: filteredDocuments
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des données récentes:', error);
    }
  };

  // Charger les données récentes au focus ou au montage si besoin
  useEffect(() => {
    if (searchOpen && !searchQuery) {
      fetchRecentData();
    }
  }, [searchOpen, searchQuery, currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
        setAnchorEl(null);
      }
    };

    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchOpen]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setSearchOpen(true);
      setIsSearching(true);
      try {
        const results: SearchResults = {
          missions: [],
          users: [],
          companies: []
        };
        
        // Récupérer le structureId de l'utilisateur
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        const structureId = userData?.structureId;

        if (!structureId) {
          setSearchResults(results);
          return;
        }
        
        // Récupérer le type de structure depuis le cache partagé
        const currentStructureType =
          structureType || cachedStructure?.structureType || 'jobservice';
        
        // Rechercher les missions/études selon le type de structure
        if (currentStructureType === 'junior') {
          // Pour les JE, rechercher les études
          const etudesQuery = firestoreQuery(
            collection(db, 'etudes'),
            where('structureId', '==', structureId),
            where('numeroEtude', '>=', query),
            where('numeroEtude', '<=', query + '\uf8ff'),
            limit(5)
          );
          
          const etudesSnapshot = await getDocs(etudesQuery);
          const missions = etudesSnapshot.docs.map(doc => {
            const data = doc.data();
            const numeroEtude = data.numeroEtude || '';
            
            return {
              id: numeroEtude || doc.id,
              type: 'mission' as const,
              title: numeroEtude || doc.id,
              subtitle: `${data.company || 'Sans entreprise'} - ${data.location || 'Sans localisation'}`,
              icon: <BusinessIcon fontSize="small" />,
              url: `/app/etude/${numeroEtude || doc.id}`
            };
          });
          
          // Rechercher aussi les documents générés dans les études
          // Les documents générés pour les études utilisent etudeNumber, pas missionNumber
          const generatedDocsQuery = firestoreQuery(
            collection(db, 'generatedDocuments'),
            where('structureId', '==', structureId),
            where('fileName', '>=', query),
            where('fileName', '<=', query + '\uf8ff'),
            limit(5)
          );
          
          try {
            const generatedDocsSnapshot = await getDocs(generatedDocsQuery);
            const generatedDocs = generatedDocsSnapshot.docs
              .filter(doc => {
                const data = doc.data();
                // Filtrer uniquement les documents liés aux études (qui ont etudeNumber)
                return data.etudeNumber;
              })
              .map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  type: 'mission' as const,
                  title: data.fileName || 'Document',
                  subtitle: `Étude ${data.etudeNumber || data.missionNumber || ''}`,
                  icon: <DescriptionIcon fontSize="small" />,
                  url: data.fileUrl
                };
              });
            
            // Ajouter les documents générés aux résultats
            results.missions = [...missions, ...generatedDocs].slice(0, 5);
          } catch (error) {
            console.error('Erreur lors de la recherche de documents générés:', error);
            results.missions = missions;
          }
        } else {
          // Pour les JS, rechercher les missions
          const missionsQuery = firestoreQuery(
            collection(db, 'missions'),
            where('structureId', '==', structureId),
            where('numeroMission', '>=', query),
            where('numeroMission', '<=', query + '\uf8ff'),
            limit(5)
          );
          
          const missionsSnapshot = await getDocs(missionsQuery);
          const missions = missionsSnapshot.docs.map(doc => {
            const data = doc.data();
            const numeroMission = data.numeroMission || '';
            
            return {
              id: numeroMission || doc.id,
              type: 'mission' as const,
              title: numeroMission || doc.id,
              subtitle: `${data.company || 'Sans entreprise'} - ${data.location || 'Sans localisation'}`,
              icon: <BusinessIcon fontSize="small" />
            };
          });
          
          results.missions = missions;
        }

        // Rechercher les utilisateurs de la structure
        const usersQuery = firestoreQuery(
          collection(db, 'users'),
          where('structureId', '==', structureId),
          where('displayName', '>=', query),
          where('displayName', '<=', query + '\uf8ff'),
          limit(5)
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        const usersRaw = usersSnapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            displayName: d.displayName || '',
            firstName: d.firstName,
            lastName: d.lastName,
            email: d.email || '',
            photoURL: d.photoURL
          };
        });
        const usersDecrypted = await decryptUsersList(usersRaw);
        const users = usersDecrypted.map((u) => {
          const raw = usersRaw.find(r => r.id === u.id);
          return {
            id: u.id,
            type: 'user' as const,
            title: u.displayName || '',
            subtitle: raw?.email || '',
            avatar: raw?.photoURL,
            icon: <Person fontSize="small" />
          };
        });

        // Rechercher les entreprises de la structure
        const companiesQuery = firestoreQuery(
          collection(db, 'companies'),
          where('structureId', '==', structureId),
          where('name', '>=', query),
          where('name', '<=', query + '\uf8ff'),
          limit(5)
        );
        
        const companiesSnapshot = await getDocs(companiesQuery);
        const companies = companiesSnapshot.docs.map(doc => ({
          id: doc.id,
          type: 'company' as const,
          title: doc.data().name || '',
          subtitle: doc.data().address || '',
          icon: <BusinessIcon fontSize="small" />
        }));

        setSearchResults({
          missions: results.missions,
          users,
          companies
        });
      } catch (error) {
        console.error('Erreur lors de la recherche:', error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchOpen(false);
      setSearchResults({
        missions: [],
        users: [],
        companies: []
      });
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    
    console.log('🔍 Clic sur résultat de recherche:', {
      type: result.type,
      id: result.id,
      title: result.title,
      url: result.url
    });
    
    // Si le résultat a une URL (document généré), ouvrir directement
    if (result.url) {
      window.open(result.url, '_blank');
      return;
    }
    
    switch (result.type) {
      case 'mission':
        // Pour les JE, naviguer vers les études, pour les JS vers les missions
        if (structureType === 'junior') {
          console.log('🚀 Navigation vers étude:', result.id);
          navigate(`/app/etude/${result.id}`);
        } else {
          console.log('🚀 Navigation vers mission:', result.id);
          navigate(`/app/mission/${result.id}`);
        }
        break;
      case 'user':
        navigate(`/app/profile?userId=${result.id}`);
        break;
      case 'company':
        navigate(`/app/entreprises/${result.id}`);
        break;
    }
  };

  // Auto-marquage des notifications comme lues au survol
  useEffect(() => {
    if (!notificationsOpen || !currentUser) {
      setVisibleNotifications(new Set());
      return;
    }

    const timers: NodeJS.Timeout[] = [];
    
    persistentNotifications.forEach(notification => {
      if (!notification.read && visibleNotifications.has(notification.id)) {
        const timer = setTimeout(() => {
          markAsRead(notification.id);
        }, 3000);
        
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notificationsOpen, persistentNotifications, currentUser, markAsRead]);

  const handleNotificationsClick = async (event: React.MouseEvent<HTMLElement>) => {
    setNotificationsAnchorEl(event.currentTarget);
    
    // Marquer toutes les notifications non lues comme lues
    await markAllAsRead();
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchorEl(null);
  };

  const handleNotificationClick = async (notification: any) => {
    try {
      // Marquer la notification comme lue si elle ne l'est pas déjà
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      // Fermer le menu de notifications
      handleNotificationsClose();

      if (
        notification.type === 'ambassador_update' &&
        notification.metadata?.eventId
      ) {
        navigate(`/app/ambassadeurs/event/${notification.metadata.eventId}`);
        return;
      }

      // Redirection spécifique pour les notifications de note de mission
      if (
        (notification.type === 'mission_note' || notification.type === 'mission_update') &&
        notification.metadata
      ) {
        const missionId = notification.metadata.missionId || notification.metadata.missionNumber;
        if (missionId) {
          navigate(`/app/mission/${missionId}`);
          return;
        }
      }

      // Redirection spécifique pour les notifications de rapport
      if (notification.type === 'report_update' || notification.type === 'report_response') {
        navigate('/app/profile?tab=reports');
      } else {
        navigate('/app/profile');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la notification:', error);
    }
  };

  return (
    <StyledAppBar position="fixed">
      <StyledToolbar sx={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
        {/* Section gauche - Logo */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5, 
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'opacity 0.2s ease',
            '&:hover': {
              opacity: 0.8
            }
          }}
          onClick={() => navigate('/app/dashboard')}
        >
          <Avatar
            src="/images/logo.png"
            alt="Logo JS Connect"
            variant="rounded"
            sx={{
              width: 56,
              height: 56,
              backgroundColor: 'white',
              mr: 0.5,
              '& img': {
                objectFit: 'contain',
                p: 0.5,
                width: '90%',
                height: '90%'
              }
            }}
          />
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            JS Connect
          </Typography>
        </Box>

        {showCompanyHeaderLogo && (
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxHeight: 48,
              maxWidth: 'min(320px, calc(100vw - 320px))',
              px: 1,
              pointerEvents: 'none',
            }}
          >
            <Box
              component="img"
              src={companyHeaderLogo}
              alt="Logo entreprise"
              sx={{
                maxHeight: 40,
                maxWidth: '100%',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </Box>
        )}
        
        {/* Section centrale - Barre de recherche */}
        {canSearch && (
          <Box
            ref={searchRef}
            sx={{
              position: 'relative',
              width: '100%',
              maxWidth: 600,
              mx: 2
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder={structureType === 'junior' ? "Rechercher une étude, un document..." : "Rechercher une mission, un document..."}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onClick={() => setSearchOpen(true)}
              sx={{
                backgroundColor: tokens.colors.bgSubtle,
                borderRadius: tokens.radius.sm,
                '& .MuiOutlinedInput-root': {
                  borderRadius: tokens.radius.sm,
                  '& fieldset': {
                    borderColor: 'transparent'
                  },
                  '&:hover fieldset': {
                    borderColor: '#d2d2d7'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#0071e3'
                  }
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: tokens.colors.textSecondary }} />
                  </InputAdornment>
                ),
                endAdornment: isSearching ? (
                  <InputAdornment position="end">
                    <CircularProgress size={20} sx={{ color: '#0071e3' }} />
                  </InputAdornment>
                ) : null
              }}
            />
            
            {searchOpen && (
              <Paper 
                elevation={3} 
                sx={{ 
                  position: 'absolute', 
                  zIndex: 1000, 
                  width: '100%', 
                  mt: 1,
                  borderRadius: tokens.radius.md,
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  border: '1px solid rgba(0,0,0,0.08)'
                }}
              >
                <List sx={{ p: 0, maxHeight: 600, overflow: 'auto' }}>
                  
                  {/* Si pas de recherche, afficher le menu type "Spotlight" */}
                  {!searchQuery.trim() ? (
                    <>
                      {/* Section Actions Rapides */}
                      <ListItem sx={{ py: 1.5, px: 2, bgcolor: '#fafafa', borderBottom: `1px solid ${tokens.colors.borderLight}` }}>
                        <Typography variant="xs" sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Actions rapides
                        </Typography>
                      </ListItem>
                      
                      <ListItem 
                        button 
                        onClick={() => { 
                          if (structureType === 'junior') {
                            navigate('/app/etude');
                          } else {
                            navigate('/app/mission');
                          }
                          setSearchOpen(false); 
                        }}
                        sx={{ py: 1.5, px: 2, '&:hover': { bgcolor: '#f5f9ff' } }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <PostAddIcon sx={{ color: '#0071e3' }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary={structureType === 'junior' ? 'Créer une nouvelle étude' : 'Créer une nouvelle mission'}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        />
                      </ListItem>

                      <ListItem 
                        button 
                        onClick={() => { navigate('/app/documents'); setSearchOpen(false); }}
                        sx={{ py: 1.5, px: 2, '&:hover': { bgcolor: '#f5f9ff' } }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <UploadFileIcon sx={{ color: '#0071e3' }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Uploader un nouveau document"
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        />
                      </ListItem>

                      <Divider sx={{ my: 0 }} />

                      {/* Section Missions/Études Récentes */}
                      <ListItem sx={{ py: 1.5, px: 2, bgcolor: '#fafafa', borderBottom: `1px solid ${tokens.colors.borderLight}`, borderTop: `1px solid ${tokens.colors.borderLight}` }}>
                        <Typography variant="xs" sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {structureType === 'junior' ? 'Études récentes' : 'Missions récentes'}
                        </Typography>
                      </ListItem>

                      {recentData.missions.length > 0 ? (
                        recentData.missions.map((mission, index) => (
                          <ListItem
                            key={`recent-mission-${index}`}
                            button
                            onClick={() => handleResultClick(mission)}
                            sx={{ py: 1, px: 2 }}
                          >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                              <HistoryIcon fontSize="small" sx={{ color: '#666' }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={mission.title}
                              secondary={mission.subtitle}
                              primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                              secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                            />
                          </ListItem>
                        ))
                      ) : (
                        <ListItem sx={{ py: 2 }}>
                          <ListItemText 
                            secondary="Aucune mission récente" 
                            secondaryTypographyProps={{ align: 'center', fontSize: '0.875rem' }}
                          />
                        </ListItem>
                      )}

                      <Divider sx={{ my: 0 }} />

                      {/* Section Documents Récents */}
                      <ListItem sx={{ py: 1.5, px: 2, bgcolor: '#fafafa', borderBottom: `1px solid ${tokens.colors.borderLight}`, borderTop: `1px solid ${tokens.colors.borderLight}` }}>
                        <Typography variant="xs" sx={{ fontWeight: 600, color: tokens.colors.textSecondary, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Fichiers récents
                        </Typography>
                      </ListItem>

                      {recentData.documents.length > 0 ? (
                        recentData.documents.map((doc, index) => (
                          <ListItem
                            key={`recent-doc-${index}`}
                            button
                            onClick={() => {
                              if (doc.url) {
                                window.open(doc.url, '_blank');
                              } else {
                                navigate('/app/documents');
                              }
                              setSearchOpen(false);
                            }}
                            sx={{ py: 1, px: 2 }}
                          >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                              <DescriptionIcon fontSize="small" sx={{ color: '#666' }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={doc.title}
                              secondary={doc.subtitle}
                              primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                              secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                            />
                          </ListItem>
                        ))
                      ) : (
                        <ListItem sx={{ py: 2 }}>
                          <ListItemText 
                            secondary="Aucun document récent" 
                            secondaryTypographyProps={{ align: 'center', fontSize: '0.875rem' }}
                          />
                        </ListItem>
                      )}
                    </>
                  ) : (
                    /* Affichage des résultats de recherche classique */
                    <>
                  
                  {/* Section Entreprises */}
                  {searchResults.companies.length > 0 && (
                    <>
                      <ListItem sx={{ 
                        bgcolor: 'rgba(0,0,0,0.02)',
                        py: 1,
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' }
                      }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BusinessIcon fontSize="small" sx={{ color: tokens.colors.textSecondary }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
                                Entreprises ({searchResults.companies.length})
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {searchResults.companies.map((company) => (
                        <ListItem
                          key={`company-${company.id}`}
                          button
                          onClick={() => handleResultClick(company)}
                          sx={{ pl: 4 }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                              {company.icon}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={company.title}
                            secondary={company.subtitle}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </>
                  )}

                  {/* Section Missions */}
                  {searchResults.missions.length > 0 && (
                    <>
                      <ListItem sx={{ 
                        bgcolor: 'rgba(0,0,0,0.02)',
                        py: 1,
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' }
                      }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BusinessIcon fontSize="small" sx={{ color: tokens.colors.textSecondary }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
                                Missions ({searchResults.missions.length})
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {searchResults.missions.map((mission) => (
                        <ListItem
                          key={`mission-${mission.id}`}
                          button
                          onClick={() => handleResultClick(mission)}
                          sx={{ pl: 4 }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                              {mission.icon}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={mission.title}
                            secondary={mission.subtitle}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </>
                  )}

                  {/* Section Utilisateurs */}
                  {searchResults.users.length > 0 && (
                    <>
                      <ListItem sx={{ 
                        bgcolor: 'rgba(0,0,0,0.02)',
                        py: 1,
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' }
                      }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Person fontSize="small" sx={{ color: tokens.colors.textSecondary }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
                                Utilisateurs ({searchResults.users.length})
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {searchResults.users.map((user) => (
                        <ListItem
                          key={`user-${user.id}`}
                          button
                          onClick={() => handleResultClick(user)}
                          sx={{ pl: 4 }}
                        >
                          <ListItemAvatar>
                            <Avatar 
                              src={user.avatar} 
                              sx={{ width: 32, height: 32 }}
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.src = '';
                                target.style.display = 'none';
                              }}
                            >
                              {!user.avatar && <Person fontSize="small" />}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={user.title}
                            secondary={user.subtitle}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </>
                  )}
                    </>
                  )}
                </List>
              </Paper>
            )}
          </Box>
        )}
        
        {/* Section droite - Actions utilisateur */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!structureQuota.loading && structureQuota.plan === 'free' && (
            <Box
              component="button"
              type="button"
              onClick={() => {
                if (structureQuota.isItemQuotaExceeded) {
                  openFreeQuotaDialog('items');
                } else if (structureQuota.isSignatureQuotaExceeded) {
                  openFreeQuotaDialog('signatures');
                } else {
                  openFreeQuotaDialog('items');
                }
              }}
              sx={{
                display: { xs: 'none', md: 'inline-flex' },
                alignItems: 'center',
                gap: 0.75,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                p: 0,
                mr: 0.5,
                '&:hover .quota-pill': { opacity: 0.85 },
              }}
              aria-label="Voir le quota gratuit et passer au plan payant"
            >
              <DsPill
                bg={
                  structureQuota.isItemQuotaExceeded || structureQuota.isSignatureQuotaExceeded
                    ? 'rgba(255, 59, 48, 0.12)'
                    : tokens.colors.gray100
                }
                fg={
                  structureQuota.isItemQuotaExceeded || structureQuota.isSignatureQuotaExceeded
                    ? '#c62828'
                    : tokens.colors.gray700
                }
              >
                <span className="quota-pill">
                  {structureQuota.freeItemsUsed}/{structureQuota.freeItemsLimit} missions & études
                  {' · '}
                  {structureQuota.freeSignatureTokensUsed}/{structureQuota.freeSignatureTokensLimit} signatures
                </span>
              </DsPill>
            </Box>
          )}
          {/* Bouton de signalement de bug */}
          <IconButton
            onClick={() => setBugDialogOpen(true)}
            size="small"
            sx={{ color: tokens.colors.textSecondary }}
          >
            <BugReportIcon fontSize="small" />
          </IconButton>

          {/* Bouton de suggestion d'idée */}
          <IconButton
            onClick={() => setIdeaDialogOpen(true)}
            size="small"
            sx={{ color: tokens.colors.textSecondary }}
          >
            <LightbulbIcon fontSize="small" />
          </IconButton>

          {/* Bouton des nouveautés - Masqué pour les contacts avec accès */}
          {canSeeChangelog && (
            <Box sx={{ position: 'relative' }}>
              <Badge
                badgeContent={hasUnseenChangelog ? 1 : 0}
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    backgroundColor: '#ff1744',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '0.7rem',
                    minWidth: 16,
                    height: 16,
                    animation: hasUnseenChangelog ? 'pulse 2s infinite' : 'none',
                    '@keyframes pulse': {
                      '0%': {
                        transform: 'scale(1)',
                        opacity: 1,
                      },
                      '50%': {
                        transform: 'scale(1.2)',
                        opacity: 0.8,
                      },
                      '100%': {
                        transform: 'scale(1)',
                        opacity: 1,
                      }
                    }
                  }
                }}
              >
                <IconButton
                  onClick={(e) => {
                    setInfoMenuAnchorEl(e.currentTarget);
                    hideInfoButtonHint();
                  }}
                  size="small"
                  sx={{ 
                    color: tokens.colors.textSecondary,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      color: tokens.colors.primary,
                      transform: 'scale(1.1)'
                    }
                  }}
                  title="Aide et tutoriel"
                >
                  <HelpIcon fontSize="small" />
                </IconButton>
              </Badge>
              <Menu
                anchorEl={infoMenuAnchorEl}
                open={infoMenuOpen}
                onClose={() => setInfoMenuAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{ paper: { sx: { mt: 1.5 } } }}
              >
                {!hasCompletedOnboarding && (
                  <MenuItem
                    onClick={() => {
                      setInfoMenuAnchorEl(null);
                      openOnboarding();
                    }}
                    sx={{ bgcolor: 'action.hover' }}
                  >
                    <ListItemIcon><SchoolIcon fontSize="small" color="primary" /></ListItemIcon>
                    <ListItemText primary="Reprendre le tutoriel" secondary="Terminer la découverte de la plateforme" />
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    setInfoMenuAnchorEl(null);
                    openChangelog();
                  }}
                >
                  <ListItemIcon><InfoIcon fontSize="small" /></ListItemIcon>
                  Nouveautés
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setInfoMenuAnchorEl(null);
                    openOnboarding();
                  }}
                >
                  <ListItemIcon><SchoolIcon fontSize="small" /></ListItemIcon>
                  Tutoriel : utiliser la plateforme
                </MenuItem>
              </Menu>
            
            {/* Animation de hint avec message */}
            {showInfoButtonHint && (
              <>
                {/* Point pulsant */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: tokens.colors.primary,
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%': {
                        transform: 'scale(0.8)',
                        opacity: 1,
                      },
                      '50%': {
                        transform: 'scale(1.2)',
                        opacity: 0.7,
                      },
                      '100%': {
                        transform: 'scale(0.8)',
                        opacity: 1,
                      }
                    }
                  }}
                />
                
                {/* Message tooltip */}
                <Paper
                  elevation={3}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    right: -10,
                    mt: 1,
                    px: 2,
                    py: 1,
                    borderRadius: tokens.radius.sm,
                    background: tokens.colors.primary,
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    zIndex: 1400,
                    animation: 'slideDown 0.3s ease-out',
                    '@keyframes slideDown': {
                      '0%': {
                        opacity: 0,
                        transform: 'translateY(-10px)',
                      },
                      '100%': {
                        opacity: 1,
                        transform: 'translateY(0)',
                      }
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      bottom: '100%',
                      right: '20px',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderBottom: `6px solid ${tokens.colors.brandTeal}`,
                    }
                  }}
                >
                  {infoButtonHintMessage}
                </Paper>
              </>
            )}
            </Box>
          )}

          {/* Bouton de notifications */}
          {canSeeNotifications && (
            <NotificationBadge
              onClick={handleNotificationsClick}
              size="small"
              sx={{ 
                color: tokens.colors.textSecondary,
                position: 'relative'
              }}
            />
          )}

          {/* Bouton de profil utilisateur */}
          <IconButton
            onClick={handleClick}
            size="small"
          >
            <Avatar
              src={currentUser?.photoURL || undefined}
              sx={{ 
                width: 32, 
                height: 32,
                bgcolor: 'primary.main',
                fontSize: '0.875rem'
              }}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.src = '';
                target.style.display = 'none';
              }}
            >
              {!currentUser?.photoURL && getInitials()}
            </Avatar>
          </IconButton>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          onClick={handleClose}
          PaperProps={{
            elevation: 0,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              '& .MuiAvatar-root': {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
              '&:before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: 0,
                right: 14,
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: 0,
              },
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            {userNameLoading ? (
              <UserNameSkeleton width={140} sx={{ fontSize: '1rem', mb: 0.5 }} />
            ) : (
              <Typography variant="subtitle1" fontWeight="bold">
                {fullName}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {currentUser?.email}
            </Typography>
          </Box>
          <Divider />
          {/* Menu selon le rôle */}
          {isEtudiant && (
            <MenuItem onClick={() => { handleClose(); navigate('/app/available-missions'); }}>
              <ListItemIcon>
                <BusinessIcon fontSize="small" />
              </ListItemIcon>
              Missions disponibles
            </MenuItem>
          )}
          <MenuItem onClick={() => { handleClose(); navigate('/app/profile'); }}>
            <ListItemIcon>
              <Person fontSize="small" />
            </ListItemIcon>
            Profil
          </MenuItem>
          {isJuniorEntreprise && (
            <MenuItem onClick={() => { handleClose(); navigate('/app/settings/structure'); }}>
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              Paramètres
            </MenuItem>
          )}
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Se déconnecter
          </MenuItem>
        </Menu>

        <Dialog open={bugDialogOpen} onClose={() => setBugDialogOpen(false)}>
          <DialogTitle>Signaler une erreur</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Décrivez l'erreur que vous avez rencontrée
            </DialogContentText>
            <TextField
              autoFocus
              multiline
              rows={4}
              fullWidth
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              label="Description de l'erreur"
              variant="outlined"
              sx={{ mb: 2 }}
            />
            <Button
              component="label"
              variant="outlined"
              startIcon={<AddPhotoAlternateIcon />}
              sx={{ mb: 1 }}
            >
              Ajouter une capture d'écran
              <VisuallyHiddenInput
                type="file"
                accept="image/*"
                onChange={handleErrorImageChange}
              />
            </Button>
            {errorImagePreview && (
              <Box sx={{ mt: 2 }}>
                <img 
                  src={errorImagePreview} 
                  alt="Aperçu" 
                  style={{ maxWidth: '100%', maxHeight: '200px' }} 
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBugDialogOpen(false)}>Annuler</Button>
            <Button 
              onClick={() => handleSubmitReport('bug')}
              disabled={!reportText.trim()}
            >
              Envoyer
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={ideaDialogOpen} onClose={() => setIdeaDialogOpen(false)}>
          <DialogTitle>Suggérer une idée</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Partagez votre suggestion d'amélioration
            </DialogContentText>
            <TextField
              autoFocus
              multiline
              rows={4}
              fullWidth
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              label="Votre suggestion"
              variant="outlined"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIdeaDialogOpen(false)}>Annuler</Button>
            <Button 
              onClick={() => handleSubmitReport('idea')}
              disabled={!reportText.trim()}
            >
              Envoyer
            </Button>
          </DialogActions>
        </Dialog>

        <Menu
          anchorEl={notificationsAnchorEl}
          open={notificationsOpen}
          onClose={handleNotificationsClose}
          PaperProps={{
            sx: { width: 320, maxHeight: 400 }
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">Notifications</Typography>
          </Box>
          <Divider />
          <NotificationList
            notifications={persistentNotifications}
            onNotificationClick={handleNotificationClick}
            maxHeight={350}
            showEmptyState={true}
            emptyStateMessage="Aucune notification"
          />
        </Menu>
      </StyledToolbar>
    </StyledAppBar>
  );
};

export default Navbar; 