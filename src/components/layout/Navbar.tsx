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
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { addReport } from '../../services/reportService';
import { uploadErrorImage } from '../../firebase/storage';
import { doc, getDoc, collection, query as firestoreQuery, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import NotificationBadge from '../ui/NotificationBadge';
import NotificationList from '../ui/NotificationList';
import { useSnackbar } from 'notistack';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#ffffff',
  color: '#111827',
  boxShadow: 'none',
  borderBottom: '1px solid #f0f0f0',
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
  const { currentUser, logoutUser } = useAuth();
  const { 
    persistentNotifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();
  const { enqueueSnackbar } = useSnackbar();

  // États pour le menu utilisateur
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

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
  const [favoriteResults, setFavoriteResults] = useState<SearchResults>({
    missions: [],
    users: [],
    companies: []
  });

  // États pour les notifications
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState<null | HTMLElement>(null);
  const notificationsOpen = Boolean(notificationsAnchorEl);
  const [visibleNotifications, setVisibleNotifications] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLDivElement>(null);

  // États pour les données utilisateur
  const [userData, setUserData] = useState<any>(null);

  // Récupérer les données utilisateur
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser?.uid) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des données utilisateur:', error);
      }
    };

    fetchUserData();
  }, [currentUser]);

  const isEtudiant = userData?.status === "etudiant";
  const isEntreprise = userData?.status === "entreprise";
  const isSuperAdmin = userData?.status === "superadmin";
  const isAdmin = userData?.status === "admin";
  const isMember = userData?.status === "membre";
  const isAdminStructure = userData?.status === "admin_structure";
  const isJuniorEntreprise = isAdminStructure || isAdmin || isMember || isSuperAdmin;
  
  // Permissions pour la recherche et notifications (uniquement pour JE)
  const canSearch = isJuniorEntreprise;
  const canSeeNotifications = isJuniorEntreprise;

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
    if (!currentUser?.displayName) return '?';
    return currentUser.displayName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase();
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
        imageUrl: imageUrl
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

  // Fonction pour récupérer les missions favorites
  const fetchFavoriteMissions = async () => {
    if (!currentUser) return;
    
    try {
      // Récupérer d'abord les IDs des missions favorites de l'utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      const favoriteMissionIds = userData?.favoriteMissions || [];

      if (favoriteMissionIds.length === 0) return;

      // Récupérer les détails de chaque mission favorite
      const missionsPromises = favoriteMissionIds.map(async (missionId: string) => {
        const missionDoc = await getDoc(doc(db, 'missions', missionId));
        if (missionDoc.exists()) {
          const data = missionDoc.data();
          return {
            id: missionDoc.id,
            type: 'mission' as const,
            title: data.numeroMission || '',
            subtitle: `${data.company || 'Sans entreprise'} - ${data.location || 'Sans localisation'}`,
            icon: <BusinessIcon fontSize="small" />
          };
        }
        return null;
      });

      const missions = (await Promise.all(missionsPromises)).filter((mission): mission is SearchResult => mission !== null);
      setFavoriteResults(prev => ({
        ...prev,
        missions
      }));
    } catch (error) {
      console.error('Erreur lors de la récupération des favoris:', error);
    }
  };

  // Effet pour charger les favoris au montage du composant
  useEffect(() => {
    fetchFavoriteMissions();
  }, [currentUser]);

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
        
        // Rechercher les missions de la structure
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
          
          console.log('🔍 Mission trouvée dans la recherche:', {
            docId: doc.id,
            numeroMission: numeroMission,
            company: data.company,
            structureId: data.structureId,
            numeroMissionType: typeof numeroMission,
            numeroMissionLength: numeroMission?.length
          });
          
          if (!numeroMission) {
            console.warn('⚠️ Mission sans numeroMission trouvée:', doc.id);
          }
          
          return {
            id: numeroMission || doc.id, // Utiliser numeroMission pour la navigation
            type: 'mission' as const,
            title: numeroMission || doc.id,
            subtitle: `${data.company || 'Sans entreprise'} - ${data.location || 'Sans localisation'}`,
            icon: <BusinessIcon fontSize="small" />
          };
        });

        // Rechercher les utilisateurs de la structure
        const usersQuery = firestoreQuery(
          collection(db, 'users'),
          where('structureId', '==', structureId),
          where('displayName', '>=', query),
          where('displayName', '<=', query + '\uf8ff'),
          limit(5)
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          type: 'user' as const,
          title: doc.data().displayName || '',
          subtitle: doc.data().email || '',
          avatar: doc.data().photoURL,
          icon: <Person fontSize="small" />
        }));

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
          missions,
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
      title: result.title
    });
    
    switch (result.type) {
      case 'mission':
        console.log('🚀 Navigation vers mission:', result.id);
        navigate(`/app/mission/${result.id}`);
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

      // Redirection spécifique pour les notifications de note de mission
      if (
        (notification.type === 'mission_note' || notification.type === 'mission_update') &&
        notification.metadata
      ) {
        const missionNumber = notification.metadata.missionNumber;
        if (missionNumber) {
          navigate(`/app/mission/${missionNumber}`);
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
      <StyledToolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        {/* Section gauche - Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Avatar
            src="/images/logo.png"
            alt="Logo JSaaS"
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
              placeholder="Rechercher une mission, un utilisateur ou une entreprise..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              sx={{
                backgroundColor: '#f5f5f7',
                borderRadius: '8px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
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
                    <SearchIcon sx={{ color: '#86868b' }} />
                  </InputAdornment>
                ),
                endAdornment: isSearching ? (
                  <InputAdornment position="end">
                    <CircularProgress size={20} sx={{ color: '#0071e3' }} />
                  </InputAdornment>
                ) : null
              }}
            />
            
            {searchOpen && (searchResults.missions.length > 0 || searchResults.users.length > 0 || searchResults.companies.length > 0) && (
              <Paper 
                elevation={3} 
                sx={{ 
                  position: 'absolute', 
                  zIndex: 1000, 
                  width: '100%', 
                  mt: 1,
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
              >
                <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
                  {!searchQuery.trim() && (
                    <ListItem sx={{ 
                      bgcolor: 'rgba(0,0,0,0.02)',
                      py: 1,
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' }
                    }}>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" sx={{ fontWeight: 500, color: '#1d1d1f' }}>
                            Missions favorites
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}
                  
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
                              <BusinessIcon fontSize="small" sx={{ color: '#86868b' }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 500, color: '#1d1d1f' }}>
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
                              <BusinessIcon fontSize="small" sx={{ color: '#86868b' }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 500, color: '#1d1d1f' }}>
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
                              <Person fontSize="small" sx={{ color: '#86868b' }} />
                              <Typography variant="subtitle2" sx={{ fontWeight: 500, color: '#1d1d1f' }}>
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
                </List>
              </Paper>
            )}
          </Box>
        )}
        
        {/* Section droite - Actions utilisateur */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Bouton de signalement de bug */}
          <IconButton
            onClick={() => setBugDialogOpen(true)}
            size="small"
            sx={{ color: '#86868b' }}
          >
            <BugReportIcon fontSize="small" />
          </IconButton>

          {/* Bouton de suggestion d'idée */}
          <IconButton
            onClick={() => setIdeaDialogOpen(true)}
            size="small"
            sx={{ color: '#86868b' }}
          >
            <LightbulbIcon fontSize="small" />
          </IconButton>

          {/* Bouton de notifications */}
          {canSeeNotifications && (
            <NotificationBadge
              onClick={handleNotificationsClick}
              size="small"
              sx={{ 
                color: '#86868b',
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
            <Typography variant="subtitle1" fontWeight="bold">
              {currentUser?.displayName}
            </Typography>
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