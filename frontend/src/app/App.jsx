import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '../features/public/Login';

const Dashboard = lazy(() => import('../features/placements/Dashboard'));
const StudentsDirectory = lazy(() => import('../features/placements/StudentsDirectory'));
const JobTracker = lazy(() => import('../features/placements/JobTracker'));
const PlacedStudents = lazy(() => import('../features/placements/PlacedStudents'));
const StudentApps = lazy(() => import('../features/placements/StudentApps'));
const Vacancies = lazy(() => import('../features/placements/Vacancies'));
const Events = lazy(() => import('../features/placements/Events'));
const Issues = lazy(() => import('../features/placements/Issues'));
const Reports = lazy(() => import('../features/placements/Reports'));
const Talentino = lazy(() => import('../features/placements/Talentino'));
const Settings = lazy(() => import('../features/admin/Settings'));
const Clients = lazy(() => import('../features/placements/Clients'));
const CertificateSign = lazy(() => import('../features/admin/CertificateSign'));
const UserManagement = lazy(() => import('../features/admin/UserManagement'));
const StudyMaterials = lazy(() => import('../features/learning/StudyMaterials'));
const TechnicalExams = lazy(() => import('../features/learning/TechnicalExams'));
const Aptitude = lazy(() => import('../features/learning/Aptitude'));
const TalentinoExams = lazy(() => import('../features/learning/TalentinoExams'));
const Courses = lazy(() => import('../features/learning/Courses'));
const PlacementDrives = lazy(() => import('../features/placements/PlacementDrives'));
const ExamsHub = lazy(() => import('../features/learning/ExamsHub'));
const Branches = lazy(() => import('../features/placements/Branches'));
const SecurityActivity = lazy(() => import('../features/admin/SecurityActivity'));
const PublicSitePage = lazy(() => import('../features/public/PublicSitePage'));

// ASSET MANAGEMENT (ERP)
const AssetList = lazy(() => import('../features/assets/AssetList'));
const AddAsset = lazy(() => import('../features/assets/AddAsset'));
const Inventory = lazy(() => import('../features/assets/Inventory'));
const AssetTransfers = lazy(() => import('../features/assets/AssetTransfers'));
const AssetMaintenance = lazy(() => import('../features/assets/AssetMaintenance'));
const AssetSettings = lazy(() => import('../features/assets/AssetSettings'));

// MEDIA & DESIGN PORTAL
const MediaTasks = lazy(() => import('../features/media/MediaTasks'));
const MediaPreview = lazy(() => import('../features/media/MediaPreview'));
const MediaFiles = lazy(() => import('../features/media/MediaFiles'));
const MediaCategories = lazy(() => import('../features/media/MediaCategories'));
const MediaSocial = lazy(() => import('../features/media/MediaSocial'));
const MediaLogs = lazy(() => import('../features/media/MediaLogs'));
const MediaSettings = lazy(() => import('../features/media/MediaSettings'));

const BrainGym = lazy(() => import('../features/learning/BrainGym'));
const CareerHub = lazy(() => import('../features/placements/CareerHub'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f6f8fb', color: '#263746', fontFamily: 'Inter, sans-serif' }}>Loading IPCS workspace…</div>}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<PublicSitePage page="about" />} />
        <Route path="/placements" element={<PublicSitePage page="placement" />} />
        <Route path="/placements/posters" element={<PublicSitePage page="placement-gallery" />} />
        <Route path="/placements/media" element={<PublicSitePage page="placement-media" />} />
        <Route path="/partners" element={<PublicSitePage page="partners" />} />
        <Route path="/partners/all" element={<PublicSitePage page="partners-all" />} />
        <Route path="/partners/media" element={<PublicSitePage page="partners-media" />} />
        <Route path="/updates" element={<PublicSitePage page="updates" />} />
        <Route path="/openings" element={<PublicSitePage page="vacancies" />} />
        <Route path="/recruiter" element={<Navigate to="/placements#recruiter-partnerships" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/career-hub" element={<CareerHub />} />
        <Route path="/admin-command" element={<Navigate to="/dashboard" replace />} />
        <Route path="/students" element={<StudentsDirectory />} />
        <Route path="/tracker" element={<JobTracker />} />
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
        <Route path="/placement-drives" element={<PlacementDrives />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/exams" element={<ExamsHub />} />
        <Route path="/exams/technical" element={<TechnicalExams />} />
        <Route path="/exams/aptitude" element={<Aptitude />} />
        <Route path="/exams/talentino" element={<TalentinoExams />} />
        <Route path="/security-logs" element={<SecurityActivity />} />
        
        {/* ASSET MANAGEMENT ERP ROUTES */}
        <Route path="/assets" element={<AssetList />} />
        <Route path="/assets/branches" element={<AssetList />} />
        <Route path="/assets/register" element={<AssetList />} />
        <Route path="/assets/assignments" element={<AssetList />} />
        <Route path="/assets/retired" element={<AssetList />} />
        <Route path="/assets/add" element={<AddAsset />} />
        <Route path="/assets/inventory" element={<Inventory />} />
        <Route path="/assets/transfers" element={<AssetTransfers />} />
        <Route path="/assets/maintenance" element={<AssetMaintenance />} />
        <Route path="/assets/dashboard" element={<Navigate to="/assets" replace />} />
        <Route path="/assets/settings" element={<AssetSettings />} />

        {/* MODULAR MEDIA & DESIGN PORTAL ROUTES */}
        <Route path="/media/dashboard" element={<MediaTasks />} />
        <Route path="/media/preview" element={<MediaPreview />} />
        <Route path="/media/files" element={<MediaFiles />} />
        <Route path="/media/categories" element={<MediaCategories />} />
        <Route path="/media/social" element={<MediaSocial />} />
        <Route path="/media/logs" element={<MediaLogs />} />
        <Route path="/media/settings" element={<MediaSettings />} />

        {/* Training & Academics is temporarily hidden for every role. */}
        <Route path="/trainer" element={<Navigate to="/dashboard" replace />} />
        <Route path="/academic/brain-gym" element={<Navigate to="/game-pal" replace />} />
        <Route path="/academic" element={<Navigate to="/dashboard" replace />} />
        <Route path="/academic/*" element={<Navigate to="/dashboard" replace />} />
        <Route path="/game-pal" element={<BrainGym />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
