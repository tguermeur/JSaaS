import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../hooks/usePermission';
import AccessDenied from '../components/common/AccessDenied';
import { AmbassadorEventsList } from '../components/missions/AmbassadorEventsList';
import { AmbassadorListTab } from '../components/missions/AmbassadorListTab';
import { AddAmbassadorDialog } from '../components/missions/AddAmbassadorDialog';
import { CreateEventDialog } from '../components/missions/CreateEventDialog';
import { CompanyInfoTab } from '../components/missions/CompanyInfoTab';
import { PersonAdd as PersonAddIcon, Event as EventIcon } from '@mui/icons-material';
import { Navigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Tab, Tabs } from '@mui/material';
import { tokens } from '../theme/tokens';
import { PortalTopBar, dsTabsSx, dsPageCanvasSx } from '../components/ds';

const Ambassadors: React.FC = () => {
  const { userData, loading: authLoading } = useAuth();
  const { canRead, canWrite, loading: permissionLoading } = usePermission('ambassadors');
  const [tabIndex, setTabIndex] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [createEventDialogOpen, setCreateEventDialogOpen] = useState(false);
  const [listTabRefresh, setListTabRefresh] = useState(0);
  const [eventsListKey, setEventsListKey] = useState(0);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const { contactPermissions, isContactWithAccess } = useAuth();

  const isStructureAdmin = ['admin', 'admin_structure', 'membre', 'superadmin'].includes(userData?.status || '');
  const isCompany = userData?.status === 'entreprise';

  const canAccessContact = isContactWithAccess && permissionsLoaded && (contactPermissions?.canViewEvents || contactPermissions?.canManageAmbassadors);
  const canAccessStructure = isStructureAdmin && canRead;
  const canAccess = canAccessStructure || (isCompany && (canAccessContact || (!isContactWithAccess && permissionsLoaded)));

  useEffect(() => {
    if (isStructureAdmin) {
      setPermissionsLoaded(true);
      return;
    }

    if (isCompany) {
      if (!isContactWithAccess) {
        setPermissionsLoaded(true);
        return;
      }

      const timer = setTimeout(() => {
        setPermissionsLoaded(true);
      }, 3000);

      return () => clearTimeout(timer);
    }

    setPermissionsLoaded(true);
  }, [isStructureAdmin, isCompany, isContactWithAccess]);

  if (authLoading || (isCompany && !permissionsLoaded) || (isStructureAdmin && permissionLoading)) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: tokens.colors.surfaceAlt,
      }}>
        <CircularProgress sx={{ color: tokens.colors.brandTeal }} />
      </Box>
    );
  }

  if (isStructureAdmin && !canRead) {
    return (
      <AccessDenied
        pageName="Ambassadeurs"
        message="Vous n'avez pas les permissions nécessaires pour accéder à cette page. Configurez l'accès dans Paramètres > Accès."
      />
    );
  }

  if (!canAccess) {
    return <Navigate to="/app/available-missions" replace />;
  }

  const actionButtonSx = {
    borderRadius: tokens.radius.lg,
    fontWeight: 600,
    textTransform: 'none' as const,
    px: 2.5,
    py: 1,
    bgcolor: tokens.colors.brandTeal,
    color: tokens.colors.marketingWhite,
    boxShadow: tokens.shadows.button,
    '&:hover': {
      bgcolor: tokens.colors.brandTeal700,
    },
  };

  return (
    <Box sx={{ ...dsPageCanvasSx, mx: -3, mt: -3 }}>
      <PortalTopBar
        title="Ambassadeurs"
        subtitle="Gérez vos événements ambassadeurs et invitez de nouveaux membres à rejoindre le programme."
        compact
        actions={
          <Box sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            {((isStructureAdmin && canWrite) || (isContactWithAccess && contactPermissions?.canViewEvents)) && (
              <Button
                variant="contained"
                startIcon={<EventIcon />}
                onClick={() => setCreateEventDialogOpen(true)}
                sx={{ ...actionButtonSx, whiteSpace: 'nowrap' }}
              >
                Créer un événement
              </Button>
            )}
            {((isStructureAdmin && canWrite) || (isContactWithAccess && contactPermissions?.canManageAmbassadors)) && (
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={() => setAddDialogOpen(true)}
                sx={{ ...actionButtonSx, whiteSpace: 'nowrap' }}
              >
                Ajouter un ambassadeur
              </Button>
            )}
          </Box>
        }
      />

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', bgcolor: tokens.colors.surfaceAlt }}>
        <Box sx={{ px: 3, pt: 1, pb: 2, maxWidth: 1400, mx: 'auto', width: '100%' }}>
          <Box sx={{ borderBottom: `1px solid ${tokens.colors.divider}`, mb: 1.5 }}>
            <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={dsTabsSx}>
              <Tab label="Événements" />
              <Tab label="Ambassadeurs" />
              <Tab label="Informations" />
            </Tabs>
          </Box>

          <Box>
            {tabIndex === 0 && <AmbassadorEventsList key={eventsListKey} />}
            {tabIndex === 1 && (
              <AmbassadorListTab
                key={listTabRefresh}
                onInvite={() => setAddDialogOpen(true)}
                showInvite={
                  (isStructureAdmin && canWrite) ||
                  Boolean(isContactWithAccess && contactPermissions?.canManageAmbassadors)
                }
              />
            )}
            {tabIndex === 2 && <CompanyInfoTab />}
          </Box>
        </Box>
      </Box>

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
    </Box>
  );
};

export default Ambassadors;
