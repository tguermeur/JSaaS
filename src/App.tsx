import * as React from 'react';
import { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import { NotificationProvider } from './contexts/NotificationContext';
import { ChangelogProvider } from './contexts/ChangelogContext';
import PrivateRoute from './components/guards/PrivateRoute';
import SuperAdminRoute from './components/guards/SuperAdminRoute';
import AuthLayout from './components/layout/AuthLayout';
import theme from './theme';
import { checkFirebaseConfig } from './firebase/auth';
import { useActivityTracker } from './hooks/useActivityTracker';
import { initGA, trackPageView } from './utils/analytics';
import ProtectedRoute from './components/ProtectedRoute';
import RequireRole from './components/guards/RequireRole';
import RequireJobServiceForAmbassadors from './components/guards/RequireJobServiceForAmbassadors';
import { useAuth } from './contexts/AuthContext';
import { SnackbarProvider, useSnackbar } from 'notistack';
import CookieConsent from './components/common/CookieConsent';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedLayout from './components/layout/ProtectedLayout';
import { AmbassadorsLayout } from './components/layout/AmbassadorsLayout';
import { getPostAuthRedirectPath } from './utils/safeAppHome';

// Pages légères — import synchrone (auth, layouts)
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import VerifyEmail from './pages/VerifyEmail';
import VerifyEmailCallback from './pages/VerifyEmailCallback';
import AuthEmailLink from './pages/AuthEmailLink';

// Pages lourdes — code splitting
const Home = React.lazy(() => import('./pages/Home'));
const Features = React.lazy(() => import('./pages/Features'));
const Contact = React.lazy(() => import('./pages/Contact'));
const Pricing = React.lazy(() => import('./pages/Pricing'));
const Register = React.lazy(() => import('./pages/Register'));
const RegisterComplete = React.lazy(() => import('./pages/RegisterComplete'));
const MentionsLegales = React.lazy(() => import('./pages/MentionsLegales'));
const PolitiqueConfidentialite = React.lazy(() => import('./pages/PolitiqueConfidentialite'));

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const OnboardingWizard = React.lazy(() => import('./pages/onboarding/OnboardingWizard'));
const SuperAdmin = React.lazy(() => import('./pages/SuperAdmin'));
const MissionDetails = React.lazy(() => import('./pages/MissionDetails'));
const EtudeDetails = React.lazy(() => import('./pages/EtudeDetails'));
const QuoteBuilder = React.lazy(() => import('./pages/QuoteBuilder'));
const Organization = React.lazy(() => import('./pages/Organization'));
const Mission = React.lazy(() => import('./pages/Mission'));
const Etude = React.lazy(() => import('./pages/Etude'));
const Settings = React.lazy(() => import('./pages/Settings'));
const AvailableMissions = React.lazy(() => import('./pages/AvailableMissions'));
const AmbassadorMissions = React.lazy(() => import('./pages/AmbassadorMissions'));
const Profile = React.lazy(() => import('./pages/Profile'));
const BillingPage = React.lazy(() => import('./pages/BillingPage'));
const EntrepriseDashboard = React.lazy(() => import('./pages/entreprise/EntrepriseDashboard'));
const HumanResources = React.lazy(() => import('./pages/HumanResources'));
const Entreprises = React.lazy(() => import('./pages/Entreprises'));
const EntrepriseDetail = React.lazy(() => import('./pages/EntrepriseDetail'));
const Commercial = React.lazy(() => import('./pages/Commercial'));
const Audit = React.lazy(() => import('./pages/Audit'));
const AuditMissionDetails = React.lazy(() => import('./pages/AuditMissionDetails'));
const AuditEtudeDetails = React.lazy(() => import('./pages/AuditEtudeDetails'));
const Tresorerie = React.lazy(() => import('./pages/Tresorerie'));
const Documents = React.lazy(() => import('./pages/Documents'));
const Signatures = React.lazy(() => import('./pages/Signatures'));
const SignDocument = React.lazy(() => import('./pages/SignDocument'));
const Ambassadors = React.lazy(() => import('./pages/Ambassadors'));
const AmbassadorEventDetails = React.lazy(() =>
  import('./pages/AmbassadorEventDetails').then((m) => ({ default: m.AmbassadorEventDetails }))
);
const ProspectDetails = React.lazy(() => import('./pages/ProspectDetails'));
const CotisationPayment = React.lazy(() => import('./pages/CotisationPayment'));
const CotisationSuccess = React.lazy(() => import('./pages/CotisationSuccess'));
const CotisationCancel = React.lazy(() => import('./pages/CotisationCancel'));

const TemplatesPDF = React.lazy(() => import('./pages/TemplatesPDF'));
const DocumentGenerator = React.lazy(() => import('./pages/DocumentGenerator'));
const TagLibrary = React.lazy(() => import('./pages/TagLibrary'));
const TemplateAssignment = React.lazy(() => import('./pages/settings/TemplateAssignment'));
const StructureSettings = React.lazy(() => import('./pages/settings/StructureSettings'));
const MissionDescriptions = React.lazy(() => import('./pages/settings/MissionDescriptions'));
const ScoringSettings = React.lazy(() => import('./pages/settings/ScoringSettings'));
const Storage = React.lazy(() => import('./pages/settings/Storage'));
const Billing = React.lazy(() => import('./pages/settings/Billing'));
const StripeCustomers = React.lazy(() => import('./pages/settings/StripeCustomers'));
const Authorizations = React.lazy(() => import('./pages/settings/Authorizations'));
const NotificationSettings = React.lazy(() => import('./pages/settings/Settings'));

function ActivityTrackerWrapper({ children }: { children: React.ReactNode }) {
  useActivityTracker();
  return <>{children}</>;
}

function OfflineNotifier() {
  const { enqueueSnackbar } = useSnackbar();
  useEffect(() => {
    const onOffline = () => enqueueSnackbar('Connexion internet perdue', { variant: 'warning' });
    const onOnline = () => enqueueSnackbar('Connexion rétablie', { variant: 'success' });
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [enqueueSnackbar]);
  return null;
}

const DefaultRedirect: React.FC = () => {
  const { userData, isContactWithAccess, contactPermissions, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Navigate
      to={getPostAuthRedirectPath({
        status: userData?.status,
        companyId: userData?.companyId,
        isContactWithAccess,
        canViewEvents: !!contactPermissions?.canViewEvents,
        canManageAmbassadors: !!contactPermissions?.canManageAmbassadors,
      })}
      replace
    />
  );
};

const PageFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

/** Ancienne URL publique → route protégée /app/... */
const RedirectToAppQuoteBuilder: React.FC = () => {
  const { missionNumber } = useParams<{ missionNumber: string }>();
  return <Navigate to={`/app/quote-builder/${missionNumber || ''}`} replace />;
};

const RedirectToAppProspect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/app/prospect/${id || ''}`} replace />;
};

function App(): JSX.Element {
  const location = useLocation();

  useEffect(() => {
    checkFirebaseConfig();
    initGA();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search, document.title);
  }, [location.pathname, location.search]);

  return (
    <ThemeProvider theme={theme}>
      <ErrorBoundary>
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          style={{ zIndex: 10000 }}
        >
          <OfflineNotifier />
          <CookieConsent />
          <ChangelogProvider>
            <ActivityTrackerWrapper>
              <NotificationProvider>
                  <Suspense fallback={<PageFallback />}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: '100vh',
                        margin: 0,
                        padding: 0,
                        width: '100%',
                        overflowX: 'hidden',
                      }}
                    >
                      <CssBaseline />
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/features" element={<Features />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route element={<AuthLayout />}>
                          <Route path="/login" element={<Login />} />
                          <Route path="/register" element={<Register />} />
                          <Route path="/register/complete" element={<RegisterComplete />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/verify-email" element={<VerifyEmail />} />
                          <Route path="/verify-email-callback" element={<VerifyEmailCallback />} />
                        </Route>
                        {/* Hors AuthLayout : finalisation magic link sans listeners Firestore parasites */}
                        <Route path="/auth/email-link" element={<AuthEmailLink />} />
                        <Route path="/sign/:requestId" element={<SignDocument />} />
                        <Route path="/mentions-legales" element={<MentionsLegales />} />
                        <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
                        <Route path="/mission" element={<Navigate to="/app/mission" replace />} />
                        <Route path="/quote-builder/:missionNumber" element={<RedirectToAppQuoteBuilder />} />
                        <Route path="/cotisation/payment" element={<CotisationPayment />} />
                        <Route path="/cotisation/success" element={<CotisationSuccess />} />
                        <Route path="/cotisation/cancel" element={<CotisationCancel />} />
                        <Route element={<PrivateRoute />}>
                          <Route path="/app" element={<ProtectedLayout />}>
                            <Route index element={<DefaultRedirect />} />
                            <Route
                              path="dashboard"
                              element={
                                <ProtectedRoute requiredPermission={{ pageId: 'dashboard', accessType: 'read' }}>
                                  <Dashboard />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="onboarding"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'superadmin']}>
                                  <OnboardingWizard />
                                </RequireRole>
                              }
                            />
                            <Route path="profile" element={<Profile />} />
                            <Route
                              path="billing-page"
                              element={
                                <RequireRole allowedRoles={['entreprise']}>
                                  <BillingPage />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="mon-espace-entreprise"
                              element={
                                <RequireRole allowedRoles={['entreprise']}>
                                  <EntrepriseDashboard />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="organization"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'organization', accessType: 'read' }}>
                                    <Organization />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="mission"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'mission', accessType: 'read' }}>
                                    <Mission />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="mission/:missionId"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin', 'entreprise', 'etudiant']}>
                                  <MissionDetails />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="mission/:missionId/quote"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <QuoteBuilder />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="etude"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'audit', accessType: 'read' }}>
                                    <Etude />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="etude/:etudeNumber"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'audit', accessType: 'read' }}>
                                    <EtudeDetails />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="etude/:etudeNumber/quote"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <QuoteBuilder />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="quote-builder/:missionNumber"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <QuoteBuilder />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="available-missions"
                              element={
                                <RequireRole allowedRoles={['etudiant', 'admin_structure', 'admin', 'membre', 'superadmin', 'entreprise']}>
                                  <AvailableMissions />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="ambassador-missions"
                              element={
                                <RequireRole allowedRoles={['etudiant']}>
                                  <AmbassadorMissions />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="human-resources"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'rh', accessType: 'read' }}>
                                    <HumanResources />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="entreprises"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'entreprises', accessType: 'read' }}>
                                    <Entreprises />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="entreprises/:id"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <EntrepriseDetail />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="documents"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'documents', accessType: 'read' }}>
                                    <Documents />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="signatures"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'documents', accessType: 'read' }}>
                                    <Signatures />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="commercial"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'commercial', accessType: 'read' }}>
                                    <Commercial />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="prospect/:id"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'commercial', accessType: 'read' }}>
                                    <ProspectDetails />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="audit"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'audit', accessType: 'read' }}>
                                    <Audit />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="audit/mission/:missionId"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <AuditMissionDetails />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="audit/etude/:etudeNumber"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <AuditEtudeDetails />
                                </RequireRole>
                              }
                            />
                            <Route
                              path="tresorerie"
                              element={
                                <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                  <ProtectedRoute requiredPermission={{ pageId: 'tresorerie', accessType: 'read' }}>
                                    <Tresorerie />
                                  </ProtectedRoute>
                                </RequireRole>
                              }
                            />
                            <Route
                              path="ambassadeurs"
                              element={
                                <RequireRole
                                  allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin', 'entreprise']}
                                  requireContactAccess={false}
                                  requireCanViewEvents={false}
                                >
                                  <RequireJobServiceForAmbassadors>
                                    <AmbassadorsLayout />
                                  </RequireJobServiceForAmbassadors>
                                </RequireRole>
                              }
                            >
                              <Route index element={<Ambassadors />} />
                              <Route path="event/:eventId" element={<AmbassadorEventDetails />} />
                            </Route>
                            <Route path="settings" element={<Settings />}>
                              <Route
                                path="templates"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                    <TemplatesPDF />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="document-generator"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                    <DocumentGenerator />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="tag-library"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                    <TagLibrary />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="template-assignment"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                    <TemplateAssignment />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="structure"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                    <StructureSettings />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="mission-descriptions"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                    <MissionDescriptions />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="scoring"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                    <ScoringSettings />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="storage"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                    <Storage />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="authorizations"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                    <Authorizations />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="billing"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'superadmin']}>
                                    <Billing />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="stripe-customers"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'superadmin']}>
                                    <StripeCustomers />
                                  </RequireRole>
                                }
                              />
                              <Route
                                path="notifications"
                                element={
                                  <RequireRole allowedRoles={['admin_structure', 'admin', 'membre', 'superadmin']}>
                                    <NotificationSettings />
                                  </RequireRole>
                                }
                              />
                            </Route>
                            <Route element={<SuperAdminRoute />}>
                              <Route path="superadmin" element={<SuperAdmin />} />
                            </Route>
                          </Route>
                        </Route>
                        <Route path="/prospect/:id" element={<RedirectToAppProspect />} />
                      </Routes>
                    </Box>
                  </Suspense>
              </NotificationProvider>
            </ActivityTrackerWrapper>
          </ChangelogProvider>
        </SnackbarProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
