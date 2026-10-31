import { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAcademicTrainerAccount, isPortalAdminAccount } from '../utils/roleAccess';
import PortalAuditCapture from '../services/PortalAuditCapture';

const lazyRoute = importer => lazy(async () => {
  try {
    const module = await importer();
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.removeItem('ipcs:lazy-route-reload'); } catch { /* Session storage can be unavailable in restricted browsers. */ }
    }
    return module;
  } catch (error) {
    const message = String(error?.message || error);
    const isChunkLoadError = /failed to fetch dynamically imported module|importing a module script failed|loading chunk .* failed|chunkloaderror/i.test(message);
    if (isChunkLoadError && typeof window !== 'undefined') {
      try {
        const key = 'ipcs:lazy-route-reload';
        const path = window.location.pathname;
        if (window.sessionStorage.getItem(key) !== path) {
          window.sessionStorage.setItem(key, path);
          window.location.reload();
        }
      } catch { /* The route error boundary below still provides a reload option. */ }
    }
    throw error;
  }
});

const Login = lazyRoute(() => import('../features/public/Login'));
const Dashboard = lazyRoute(() => import('../features/placements/Dashboard'));
const StudentsDirectory = lazyRoute(() => import('../features/placements/StudentsDirectory'));
const JobTracker = lazyRoute(() => import('../features/placements/JobTracker'));
const PlacedStudents = lazyRoute(() => import('../features/placements/PlacedStudents'));
const StudentApps = lazyRoute(() => import('../features/placements/StudentApps'));
const Vacancies = lazyRoute(() => import('../features/placements/Vacancies'));
const Events = lazyRoute(() => import('../features/placements/Events'));
const Issues = lazyRoute(() => import('../features/placements/Issues'));
const Reports = lazyRoute(() => import('../features/placements/Reports'));
const Talentino = lazyRoute(() => import('../features/placements/Talentino'));
const Settings = lazyRoute(() => import('../features/admin/Settings'));
const Clients = lazyRoute(() => import('../features/placements/Clients'));
const CertificateSign = lazyRoute(() => import('../features/admin/CertificateSign'));
const UserManagement = lazyRoute(() => import('../features/admin/UserManagement'));
const StudyMaterials = lazyRoute(() => import('../features/learning/StudyMaterials'));
const TechnicalExams = lazyRoute(() => import('../features/learning/TechnicalExams'));
const Aptitude = lazyRoute(() => import('../features/learning/Aptitude'));
const TalentinoExams = lazyRoute(() => import('../features/learning/TalentinoExams'));
const Courses = lazyRoute(() => import('../features/learning/Courses'));
const PlacementDrives = lazyRoute(() => import('../features/placements/PlacementDrives'));
const ExamsHub = lazyRoute(() => import('../features/learning/ExamsHub'));
const Branches = lazyRoute(() => import('../features/placements/Branches'));
const SecurityActivity = lazyRoute(() => import('../features/admin/SecurityActivity'));
const PlacementReconciliation = lazyRoute(() => import('../features/admin/PlacementReconciliation'));
const CorporateTrainingInquiries = lazyRoute(() => import('../features/admin/CorporateTrainingInquiries'));
const HiringInquiries = lazyRoute(() => import('../features/admin/HiringInquiries'));
const PublicSitePage = lazyRoute(() => import('../features/public/PublicSitePage'));

// Standalone Asset Management workspace
const AssetList = lazyRoute(() => import('../features/assets/AssetList'));
const AssetDashboard = lazyRoute(() => import('../features/assets/AssetDashboard'));
const AddAsset = lazyRoute(() => import('../features/assets/AddAsset'));
const AssetCategories = lazyRoute(() => import('../features/assets/AssetCategories'));
const Inventory = lazyRoute(() => import('../features/assets/Inventory'));
const AssetTransfers = lazyRoute(() => import('../features/assets/AssetTransfers'));
const AssetMaintenance = lazyRoute(() => import('../features/assets/AssetMaintenance'));
const AssetSettings = lazyRoute(() => import('../features/assets/AssetSettings'));
const AssetPreferences = lazyRoute(() => import('../features/assets/AssetPreferences'));
const AssetApprovals = lazyRoute(() => import('../features/assets/AssetApprovals'));
const AssetQrCenter = lazyRoute(() => import('../features/assets/AssetQrCenter'));
const AssetMailCenter = lazyRoute(() => import('../features/assets/AssetMailCenter'));
const AssetActivity = lazyRoute(() => import('../features/assets/AssetActivity'));

// MEDIA & DESIGN PORTAL
const MediaTasks = lazyRoute(() => import('../features/media/MediaTasks'));
const MediaPreview = lazyRoute(() => import('../features/media/MediaPreview'));
const MediaFiles = lazyRoute(() => import('../features/media/MediaFiles'));
const MediaCategories = lazyRoute(() => import('../features/media/MediaCategories'));
const MediaSocial = lazyRoute(() => import('../features/media/MediaSocial'));
const MediaLogs = lazyRoute(() => import('../features/media/MediaLogs'));
const MediaSettings = lazyRoute(() => import('../features/media/MediaSettings'));

const BrainGym = lazyRoute(() => import('../features/learning/BrainGym'));
const CareerHub = lazyRoute(() => import('../features/placements/CareerHub'));
const AcademicOverview = lazyRoute(() => import('../features/learning/AcademicOverview'));
const AcademicTraining = lazyRoute(() => import('../features/learning/AcademicTraining'));
const AcademicBatches = lazyRoute(() => import('../features/learning/AcademicBatches'));
const AcademicSessions = lazyRoute(() => import('../features/learning/AcademicSessions'));
const AcademicAttendance = lazyRoute(() => import('../features/learning/AcademicAttendance'));
const AcademicDiary = lazyRoute(() => import('../features/learning/AcademicDiary'));
const AcademicWorkspace = lazyRoute(() => import('../features/learning/AcademicWorkspace'));

function PlacementDrivesRoute() {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* Login will handle an invalid session. */ }
  const role = String(account?.role || '').toUpperCase();
  const isAdmin = isPortalAdminAccount(account);
  const isTpo = role.includes('TPO') || role.includes('PLACEMENT OFFICER');
  return isTpo && !isAdmin ? <Navigate to="/tracker" replace /> : <PlacementDrives />;
}

function PlacementTrackerRoute() {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* An invalid session should return to sign in. */ }
  if (!account) return <Navigate to="/login" replace />;
  const role = String(account.role || '').toUpperCase();
  const isTpo = role.includes('TPO') || role.includes('PLACEMENT OFFICER');
  return isTpo && !isPortalAdminAccount(account) ? <JobTracker /> : <Navigate to="/dashboard" replace />;
}

function AssetManagementAccessRoute() {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* Invalid local session data returns to sign in. */ }
  if (!account) return <Navigate to="/login" replace />;

  const role = String(account.role || '').trim().toUpperCase();
  const hasAssetAccess = role.includes('ASSET') || String(account.accessType || '').toLowerCase().includes('asset');
  const isBranchManager = role === 'BM' || role.includes('BRANCH MANAGER');
  if (!isPortalAdminAccount(account) && !isBranchManager && !hasAssetAccess) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function MediaStudioAccessRoute() {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* Invalid local session data returns to sign in. */ }
  if (!account) return <Navigate to="/login" replace />;

  const role = String(account.role || '').trim().toUpperCase();
  const isMediaTeam = ['DESIGN', 'MEDIA', 'CREATIVE'].some(part => role.includes(part));
  return isPortalAdminAccount(account) || isMediaTeam ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

function PlacementReconciliationRoute() {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* Invalid local session data returns to sign in. */ }
  if (!account) return <Navigate to="/login" replace />;
  return String(account.email || '').trim().toLowerCase() === 'gifty@ipcsglobal.com'
    ? <PlacementReconciliation />
    : <Navigate to="/dashboard" replace />;
}

function TrainerAcademicAccessRoute() {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* Invalid local session data returns to sign in. */ }
  return account && isAcademicTrainerAccount(account) ? <Outlet /> : <Navigate to={account ? '/dashboard' : '/login'} replace />;
}

function TrainerWorkspaceRoute() {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* Invalid local session data returns to sign in. */ }
  return account && isAcademicTrainerAccount(account) ? <Navigate to="/academic" replace /> : <Navigate to={account ? '/dashboard' : '/login'} replace />;
}

function TrainerDashboardRoute() {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* Invalid local session data returns to sign in. */ }
  return account && isAcademicTrainerAccount(account) ? <Navigate to="/academic" replace /> : <Dashboard />;
}

function AssetManagerAccessRoute({ children }) {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* Invalid local session data returns to sign in. */ }
  const role = String(account?.role || '').trim().toUpperCase();
  const isBranchManager = role === 'BM' || role.includes('BRANCH MANAGER');
  const canManage = isPortalAdminAccount(account) || isBranchManager || role.includes('ASSET') || String(account?.accessType || '').toLowerCase().includes('asset');
  return canManage ? children : <Navigate to="/assets/branches" replace />;
}

function AssetSystemSettingsAccessRoute({ children }) {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* Invalid local session data returns to sign in. */ }
  return isPortalAdminAccount(account) ? children : <Navigate to="/assets/dashboard" replace />;
}

function UnknownRoute() {
  let account = null;
  try { account = JSON.parse(localStorage.getItem('tpoData') || 'null'); } catch { /* Treat invalid session data as signed out. */ }
  return <Navigate to={account ? '/dashboard' : '/login'} replace />;
}

class RouteErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Portal route failed to render:', error, info.componentStack);
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: 12, padding: 24, background: '#f6f8fb', color: '#263746', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>This section could not be opened</h1>
        <p style={{ margin: 0 }}>Reload the portal to try loading it again.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ justifySelf: 'center', padding: '10px 18px', border: 0, borderRadius: 8, background: '#1769aa', color: '#fff', cursor: 'pointer' }}>Reload portal</button>
      </main>
    );
  }
}

function RoutedContent() {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKey={location.key || location.pathname}>
      <Suspense fallback={<div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f6f8fb', color: '#263746', fontFamily: 'Inter, sans-serif' }}>Loading IPCS workspace…</div>}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<PublicSitePage page="about" />} />
        <Route path="/corporate-training" element={<PublicSitePage page="corporate-training" />} />
        <Route path="/placements" element={<PublicSitePage page="placement" />} />
        <Route path="/placements/posters" element={<PublicSitePage page="placement-gallery" />} />
        <Route path="/placements/media" element={<PublicSitePage page="placement-media" />} />
        <Route path="/hiring" element={<Navigate to="/placements#vacancies" replace />} />
        <Route path="/partners" element={<PublicSitePage page="partners" />} />
        <Route path="/partners/all" element={<PublicSitePage page="partners-all" />} />
        <Route path="/partners/media" element={<PublicSitePage page="partners-media" />} />
        <Route path="/updates" element={<PublicSitePage page="updates" />} />
        <Route path="/openings" element={<PublicSitePage page="openings" />} />
        <Route path="/recruiter" element={<Navigate to="/placements#recruiter-partnerships" replace />} />
        <Route path="/dashboard" element={<TrainerDashboardRoute />} />
        <Route path="/career-hub" element={<CareerHub />} />
        <Route path="/admin-command" element={<Navigate to="/dashboard" replace />} />
        <Route path="/students" element={<StudentsDirectory />} />
        <Route path="/tracker" element={<PlacementTrackerRoute />} />
        <Route path="/placed" element={<PlacedStudents />} />
        <Route path="/applications" element={<StudentApps />} />
        <Route path="/vacancies" element={<Vacancies />} />
        <Route path="/events" element={<Events />} />
        <Route path="/issues" element={<Issues />} /> 
        <Route path="/reports" element={<Reports />} />
        <Route path="/talentino" element={<Talentino />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/sign-certificate/:id" element={<CertificateSign />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/study-materials" element={<StudyMaterials />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/placement-drives" element={<PlacementDrivesRoute />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/exams" element={<ExamsHub />} />
        <Route path="/exams/technical" element={<TechnicalExams />} />
        <Route path="/exams/aptitude" element={<Aptitude />} />
        <Route path="/exams/talentino" element={<TalentinoExams />} />
        <Route path="/security-logs" element={<SecurityActivity />} />
        <Route path="/placement-reconciliation" element={<PlacementReconciliationRoute />} />
        <Route path="/admin/corporate-training" element={<CorporateTrainingInquiries />} />
        <Route path="/hiring-inquiries" element={<HiringInquiries />} />
        
        {/* Standalone asset workspace: its own navigation, page shell, and role gate. */}
        <Route path="/assets" element={<AssetManagementAccessRoute />}>
          <Route index element={<Navigate to="/assets/dashboard" replace />} />
          <Route path="dashboard" element={<AssetDashboard />} />
          <Route path="branches" element={<AssetList />} />
          <Route path="register" element={<AssetList />} />
          <Route path="assignments" element={<AssetList />} />
          <Route path="retired" element={<AssetList />} />
          <Route path="add" element={<AssetManagerAccessRoute><AddAsset /></AssetManagerAccessRoute>} />
          <Route path="categories" element={<AssetManagerAccessRoute><AssetCategories /></AssetManagerAccessRoute>} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="transfers" element={<AssetTransfers />} />
          <Route path="maintenance" element={<AssetMaintenance />} />
          <Route path="approvals" element={<AssetApprovals />} />
          <Route path="qr" element={<AssetQrCenter />} />
          <Route path="mail" element={<AssetMailCenter />} />
          <Route path="activity" element={<AssetActivity />} />
          <Route path="settings" element={<AssetPreferences />} />
          <Route path="setup" element={<AssetSystemSettingsAccessRoute><AssetSettings /></AssetSystemSettingsAccessRoute>} />
          <Route path="*" element={<Navigate to="/assets/dashboard" replace />} />
        </Route>

        {/* Standalone Media & Design Studio; backend routes enforce the same role restriction. */}
        <Route path="/media" element={<MediaStudioAccessRoute />}>
          <Route index element={<Navigate to="/media/dashboard" replace />} />
          <Route path="dashboard" element={<MediaTasks />} />
          <Route path="preview" element={<MediaPreview />} />
          <Route path="files" element={<MediaFiles />} />
          <Route path="categories" element={<MediaCategories />} />
          <Route path="social" element={<MediaSocial />} />
          <Route path="logs" element={<MediaLogs />} />
          <Route path="settings" element={<MediaSettings />} />
          <Route path="*" element={<Navigate to="/media/dashboard" replace />} />
        </Route>

        <Route path="/trainer" element={<TrainerWorkspaceRoute />} />
        <Route path="/academic" element={<TrainerAcademicAccessRoute />}>
          <Route index element={<AcademicOverview trainerMode />} />
          <Route path="brain-gym" element={<BrainGym academicMode />} />
          <Route path="branches" element={<AcademicOverview trainerMode />} />
          <Route path="leaves" element={<AcademicOverview trainerMode />} />
          <Route path="training" element={<AcademicTraining />} />
          <Route path="batches" element={<AcademicBatches />} />
          <Route path="sessions" element={<AcademicSessions />} />
          <Route path="attendance" element={<AcademicAttendance />} />
          <Route path="topics" element={<AcademicWorkspace module="topics" />} />
          <Route path="diary" element={<AcademicDiary />} />
          <Route path="*" element={<Navigate to="/academic" replace />} />
        </Route>
        <Route path="/game-pal" element={<BrainGym />} />
        <Route path="*" element={<UnknownRoute />} />
      </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

function App() {
  return (
    <BrowserRouter>
      <PortalAuditCapture />
      <RoutedContent />
    </BrowserRouter>
  );
}

export default App;
