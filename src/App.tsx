import * as React from 'react';
import { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ChangelogProvider } from './contexts/ChangelogContext';
import PrivateRoute from './components/guards/PrivateRoute';
import SuperAdminRoute from './components/guards/SuperAdminRoute';
import Layout from './components/layout/Layout';
import AuthLayout from './components/layout/AuthLayout';
import theme from './theme';
import { MissionProvider } from './contexts/MissionContext';
import { checkFirebaseConfig } from './firebase/auth';
import { useActivityTracker } from './hooks/useActivityTracker';
import TemplatesPDF from './pages/TemplatesPDF';
import DocumentGenerator from './pages/DocumentGenerator';
import TagLibrary from './pages/TagLibrary';
import TemplateAssignment from './pages/settings/TemplateAssignment';
import StructureSettings from './pages/settings/StructureSettings';
import MissionDescriptions from './pages/settings/MissionDescriptions';
import Storage from './pages/settings/Storage';
import Billing from './pages/settings/Billing';
import BillingPage from './pages/BillingPage';
import HumanResources from './pages/HumanResources';
import Entreprises from './pages/Entreprises';
import EntrepriseDetail from './pages/EntrepriseDetail';
import Commercial from './pages/Commercial';
import Audit from './pages/Audit';
import AuditMissionDetails from './pages/AuditMissionDetails';
import MentionsLegales from './pages/MentionsLegales';
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite';
import ProtectedRoute from './components/ProtectedRoute';
import RequireRole from './components/guards/RequireRole';
import Tresorerie from './pages/Tresorerie';
import StripeCustomers from './pages/settings/StripeCustomers';
import { SnackbarProvider } from 'notistack';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Organization from './pages/Organization';
import SuperAdmin from './pages/SuperAdmin';
import Mission from './pages/Mission';
import MissionDetails from './pages/MissionDetails';
import Etude from './pages/Etude';
import EtudeDetails from './pages/EtudeDetails';
import QuoteBuilder from './pages/QuoteBuilder';
import Settings from './pages/Settings';
import AvailableMissions from './pages/AvailableMissions';

import ForgotPassword from './pages/ForgotPassword';
import ProspectDetails from './pages/ProspectDetails';
import VerifyEmail from './pages/VerifyEmail';
import VerifyEmailCallback from './pages/VerifyEmailCallback';
import Authorizations from './pages/settings/Authorizations';
import ProtectedLayout from './components/layout/ProtectedLayout';
import Features from './pages/Features';
import Contact from './pages/Contact';
import Pricing from './pages/Pricing';
import NotificationSettings from './pages/settings/Settings';
import Profile from './pages/Profile';
import CotisationPayment from './pages/CotisationPayment';
import CotisationSuccess from './pages/CotisationSuccess';
import CotisationCancel from './pages/CotisationCancel';
import Documents from './pages/Documents';


// Composant wrapper pour le suivi d'activité
function ActivityTrackerWrapper({ children }: { children: React.ReactNode }) {
  useActivityTracker();
  return <>{children}</>;
}

function App(): JSX.Element {
  useEffect(() => {
    // Vérifier la configuration Firebase
    checkFirebaseConfig();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <SnackbarProvider maxSnack={3}>
        <AuthProvider>
          <ChangelogProvider>
            <ActivityTrackerWrapper>
              <NotificationProvider>
                <MissionProvider>
              <Suspense fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                  <CircularProgress />
                </Box>
              }>
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <CssBaseline />
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/features" element={<Features />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route element={<AuthLayout />}>
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/verify-email" element={<VerifyEmail />} />
                      <Route path="/verify-email-callback" element={<VerifyEmailCallback />} />
                    </Route>
                    <Route path="/mentions-legales" element={<MentionsLegales />} />
                    <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
                    <Route path="/mission" element={<Navigate to="/app/mission" replace />} />
                    <Route path="/quote-builder/:missionNumber" element={<QuoteBuilder />} />
                    <Route path="/cotisation/payment" element={<CotisationPayment />} />
                    <Route path="/cotisation/success" element={<CotisationSuccess />} />
                    <Route path="/cotisation/cancel" element={<CotisationCancel />} />
                    <Route path="/app" element={<ProtectedLayout />}>
                      <Route index element={<Navigate to="/app/dashboard" replace />} />
                      <Route path="dashboard" element={
                        <ProtectedRoute requiredPermission={{ pageId: 'dashboard', accessType: 'read' }}>
                          <Dashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="profile" element={<Profile />} />
                      {/* BillingPage pour les entreprises */}
                      <Route path="billing-page" element={
                        <RequireRole allowedRoles={['entreprise']}>
                          <BillingPage />
                        </RequireRole>
                      } />
                      {/* Routes accessibles selon le rôle */}
                      <Route path="organization" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <ProtectedRoute requiredPermission={{ pageId: 'organization', accessType: 'read' }}>
                            <Organization />
                          </ProtectedRoute>
                        </RequireRole>
                      } />
                      <Route path="mission" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <ProtectedRoute requiredPermission={{ pageId: 'mission', accessType: 'read' }}>
                            <Mission />
                          </ProtectedRoute>
                        </RequireRole>
                      } />
                      <Route path="mission/:missionId" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin', 'entreprise', 'etudiant']}>
                          <MissionDetails />
                        </RequireRole>
                      } />
                      <Route path="mission/:missionId/quote" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <QuoteBuilder />
                        </RequireRole>
                      } />
                      <Route path="etude" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <ProtectedRoute requiredPermission={{ pageId: 'etude', accessType: 'read' }}>
                            <Etude />
                          </ProtectedRoute>
                        </RequireRole>
                      } />
                      <Route path="etude/:etudeNumber" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <EtudeDetails />
                        </RequireRole>
                      } />
                      <Route path="etude/:etudeNumber/quote" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <QuoteBuilder />
                        </RequireRole>
                      } />
                      <Route path="quote-builder/:missionNumber" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <QuoteBuilder />
                        </RequireRole>
                      } />
                      <Route path="available-missions" element={
                        <RequireRole allowedRoles={['etudiant', 'admin_structure', 'admin', 'membre', 'superadmin']}>
                          <AvailableMissions />
                        </RequireRole>
                      } />

                      {/* Routes réservées aux Junior-Entreprises (admin_structure, admin, membre, superadmin) */}
                      <Route path="human-resources" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <ProtectedRoute requiredPermission={{ pageId: 'rh', accessType: 'read' }}>
                            <HumanResources />
                          </ProtectedRoute>
                        </RequireRole>
                      } />
                      <Route path="entreprises" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <ProtectedRoute requiredPermission={{ pageId: 'entreprises', accessType: 'read' }}>
                            <Entreprises />
                          </ProtectedRoute>
                        </RequireRole>
                      } />
                      <Route path="entreprises/:id" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <EntrepriseDetail />
                        </RequireRole>
                      } />
                      <Route path="documents" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <Documents />
                        </RequireRole>
                      } />
                      <Route path="commercial" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <ProtectedRoute requiredPermission={{ pageId: 'commercial', accessType: 'read' }}>
                            <Commercial />
                          </ProtectedRoute>
                        </RequireRole>
                      } />
                      <Route path="audit" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <ProtectedRoute requiredPermission={{ pageId: 'audit', accessType: 'read' }}>
                            <Audit />
                          </ProtectedRoute>
                        </RequireRole>
                      } />
                      <Route path="audit/mission/:missionId" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <AuditMissionDetails />
                        </RequireRole>
                      } />
                      <Route path="tresorerie" element={
                        <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                          <ProtectedRoute requiredPermission={{ pageId: 'tresorerie', accessType: 'read' }}>
                            <Tresorerie />
                          </ProtectedRoute>
                        </RequireRole>
                      } />
                      <Route path="settings" element={<Settings />}>
                        <Route path="templates" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                            <TemplatesPDF />
                          </RequireRole>
                        } />
                        <Route path="document-generator" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                            <DocumentGenerator />
                          </RequireRole>
                        } />
                        <Route path="tag-library" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                            <TagLibrary />
                          </RequireRole>
                        } />
                        <Route path="template-assignment" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                            <TemplateAssignment />
                          </RequireRole>
                        } />
                        <Route path="structure" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                            <StructureSettings />
                          </RequireRole>
                        } />
                        <Route path="mission-descriptions" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                            <MissionDescriptions />
                          </RequireRole>
                        } />
                        <Route path="storage" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                            <Storage />
                          </RequireRole>
                        } />
                        <Route path="authorizations" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                            <Authorizations />
                          </RequireRole>
                        } />
                        {/* Billing pour admin_structure, admin, superadmin */}
                        <Route path="billing" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'superadmin']}>
                            <Billing />
                          </RequireRole>
                        } />
                        <Route path="stripe-customers" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'superadmin']}>
                            <StripeCustomers />
                          </RequireRole>
                        } />
                        <Route path="notifications" element={
                          <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                            <NotificationSettings />
                          </RequireRole>
                        } />
                      </Route>
                      <Route element={<SuperAdminRoute />}>
                        <Route path="superadmin" element={<SuperAdmin />} />
                      </Route>
                    </Route>
                    <Route path="/prospect/:id" element={<ProspectDetails />} />
                  </Routes>
                </Box>
              </Suspense>
              </MissionProvider>
            </NotificationProvider>
            </ActivityTrackerWrapper>
          </ChangelogProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App; 