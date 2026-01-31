import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AmbassadorEventsList } from '../components/missions/AmbassadorEventsList';
import { AmbassadorListTab } from '../components/missions/AmbassadorListTab';
import { AddAmbassadorDialog } from '../components/missions/AddAmbassadorDialog';
import { CreateEventDialog } from '../components/missions/CreateEventDialog';
import { CompanyInfoTab } from '../components/missions/CompanyInfoTab';
import { PersonAdd as PersonAddIcon, Event as EventIcon } from '@mui/icons-material';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';

const Ambassadors: React.FC = () => {
  const { userData, loading: authLoading } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [createEventDialogOpen, setCreateEventDialogOpen] = useState(false);
  const [listTabRefresh, setListTabRefresh] = useState(0);
  const [eventsListKey, setEventsListKey] = useState(0);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const { contactPermissions, isContactWithAccess } = useAuth();
  
  // Determine roles - Seulement admins/entreprises peuvent accéder
  const isStructureAdmin = ['admin', 'admin_structure', 'membre', 'superadmin'].includes(userData?.status || '');
  const isCompany = userData?.status === 'entreprise';
  
  // Pour les contacts avec accès, vérifier les permissions
  // Si contactPermissions est null, cela peut signifier "pas encore chargé" ou "pas de permissions"
  // On attend que permissionsLoaded soit true avant de vérifier
  const canAccessContact = isContactWithAccess && permissionsLoaded && (contactPermissions?.canViewEvents || contactPermissions?.canManageAmbassadors);
  const canAccess = isStructureAdmin || (isCompany && (canAccessContact || (!isContactWithAccess && permissionsLoaded)));

  // Attendre que les permissions soient chargées pour les contacts entreprise
  useEffect(() => {
    if (isStructureAdmin) {
      // Les admins de structure ont toujours accès, pas besoin d'attendre
      setPermissionsLoaded(true);
      return;
    }
    
    if (isCompany) {
      if (!isContactWithAccess) {
        // Si ce n'est pas un contact avec accès, pas besoin d'attendre
        setPermissionsLoaded(true);
        return;
      }
      
      // Pour les contacts avec accès, attendre un délai pour laisser le temps au contexte de charger
      // Le contexte charge les permissions de manière asynchrone via onSnapshot
      // On attend un délai raisonnable (3 secondes) pour laisser le temps en production
      const timer = setTimeout(() => {
        setPermissionsLoaded(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
    
    // Pour les autres cas, pas besoin d'attendre
    setPermissionsLoaded(true);
  }, [isStructureAdmin, isCompany, isContactWithAccess]);

  // Afficher un loader pendant le chargement des permissions
  if (authLoading || (isCompany && !permissionsLoaded)) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: '#fafafa'
      }}>
        <CircularProgress sx={{ color: '#2563eb' }} />
      </Box>
    );
  }

  // Rediriger les étudiants vers available-missions
  if (!canAccess) {
    return <Navigate to="/app/available-missions" replace />;
  }

  const appleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        padding: '40px 24px 80px 24px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {/* Header avec design Apple */}
          <div style={{ 
            display: 'flex', 
            flexDirection: window.innerWidth < 640 ? 'column' : 'row',
            alignItems: window.innerWidth < 640 ? 'flex-start' : 'flex-start',
            justifyContent: 'space-between',
            gap: '24px'
          }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ 
                fontSize: '56px',
                fontWeight: 600,
                color: '#111827',
                marginBottom: '16px',
                lineHeight: '1.1',
                letterSpacing: '-0.04em',
                fontFamily: appleFont,
                margin: 0,
                padding: 0
              }}>
                Ambassadeurs
              </h1>
              <p style={{ 
                fontSize: '20px',
                color: '#4b5563',
                maxWidth: '600px',
                lineHeight: '1.6',
                margin: 0,
                fontFamily: appleFont
              }}>
                Gérez vos événements ambassadeurs et invitez de nouveaux membres à rejoindre le programme.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              {/* Bouton créer un événement - visible pour tous ceux qui ont accès */}
              {(isStructureAdmin || (isContactWithAccess && contactPermissions?.canViewEvents)) && (
                <button
                  onClick={() => setCreateEventDialogOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 28px',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    borderRadius: '16px',
                    fontWeight: 600,
                    fontSize: '15px',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: appleFont,
                    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.25)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1d4ed8';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 12px 30px -5px rgba(37, 99, 235, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.25)';
                  }}
                >
                  <EventIcon sx={{ fontSize: 22 }} />
                  <span>Créer un événement</span>
                </button>
              )}
              {/* Bouton ajouter un ambassadeur - visible pour tous, mais avec popup pour contacts avec accès */}
              {(isStructureAdmin || (isContactWithAccess && contactPermissions?.canManageAmbassadors)) && (
                <button
                  onClick={() => setAddDialogOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 28px',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    borderRadius: '16px',
                    fontWeight: 600,
                    fontSize: '15px',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: appleFont,
                    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.25)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1d4ed8';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 12px 30px -5px rgba(37, 99, 235, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.25)';
                  }}
                >
                  <PersonAddIcon sx={{ fontSize: 22 }} />
                  <span>Ajouter un Ambassadeur</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabs avec design Apple */}
          <div style={{ 
            borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
            marginBottom: '0'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setTabIndex(0)}
                style={{
                  padding: '16px 32px',
                  fontWeight: 600,
                  fontSize: '14px',
                  fontFamily: appleFont,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: tabIndex === 0 ? '#2563eb' : '#6b7280',
                  position: 'relative',
                  transition: 'color 0.2s ease',
                  margin: 0
                }}
                onMouseEnter={(e) => {
                  if (tabIndex !== 0) {
                    e.currentTarget.style.color = '#374151';
                  }
                }}
                onMouseLeave={(e) => {
                  if (tabIndex !== 0) {
                    e.currentTarget.style.color = '#6b7280';
                  }
                }}
              >
                Événements
                {tabIndex === 0 && (
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    backgroundColor: '#2563eb',
                    borderRadius: '999px'
                  }} />
                )}
              </button>
              <button
                onClick={() => setTabIndex(1)}
                style={{
                  padding: '16px 32px',
                  fontWeight: 600,
                  fontSize: '14px',
                  fontFamily: appleFont,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: tabIndex === 1 ? '#2563eb' : '#6b7280',
                  position: 'relative',
                  transition: 'color 0.2s ease',
                  margin: 0
                }}
                onMouseEnter={(e) => {
                  if (tabIndex !== 1) {
                    e.currentTarget.style.color = '#374151';
                  }
                }}
                onMouseLeave={(e) => {
                  if (tabIndex !== 1) {
                    e.currentTarget.style.color = '#6b7280';
                  }
                }}
              >
                Ambassadeurs
                {tabIndex === 1 && (
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    backgroundColor: '#2563eb',
                    borderRadius: '999px'
                  }} />
                )}
              </button>
              <button
                onClick={() => setTabIndex(2)}
                style={{
                  padding: '16px 32px',
                  fontWeight: 600,
                  fontSize: '14px',
                  fontFamily: appleFont,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: tabIndex === 2 ? '#2563eb' : '#6b7280',
                  position: 'relative',
                  transition: 'color 0.2s ease',
                  margin: 0
                }}
                onMouseEnter={(e) => {
                  if (tabIndex !== 2) {
                    e.currentTarget.style.color = '#374151';
                  }
                }}
                onMouseLeave={(e) => {
                  if (tabIndex !== 2) {
                    e.currentTarget.style.color = '#6b7280';
                  }
                }}
              >
                Informations
                {tabIndex === 2 && (
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    backgroundColor: '#2563eb',
                    borderRadius: '999px'
                  }} />
                )}
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ marginTop: '40px' }}>
            {tabIndex === 0 && <AmbassadorEventsList key={eventsListKey} />}
            {tabIndex === 1 && <AmbassadorListTab key={listTabRefresh} />}
            {tabIndex === 2 && <CompanyInfoTab />}
          </div>
        </div>
      </div>

      <AddAmbassadorDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={() => {
          setListTabRefresh((k) => k + 1);
        }}
      />
      <CreateEventDialog
        open={createEventDialogOpen}
        onClose={() => setCreateEventDialogOpen(false)}
        onSuccess={() => {
          setEventsListKey((k) => k + 1);
        }}
      />
    </div>
  );
};

export default Ambassadors;
