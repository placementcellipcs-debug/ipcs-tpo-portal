import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';

const RecruiterMOU = lazy(() => import('./RecruiterMOU'));
const Dashboard = lazy(() => import('./Dashboard'));
const StudentsDirectory = lazy(() => import('./StudentsDirectory'));
const JobTracker = lazy(() => import('./JobTracker'));
const PlacedStudents = lazy(() => import('./PlacedStudents'));
const StudentApps = lazy(() => import('./StudentApps'));
const Vacancies = lazy(() => import('./Vacancies'));
const Events = lazy(() => import('./Events'));
const Issues = lazy(() => import('./Issues'));
const Reports = lazy(() => import('./Reports'));
const Talentino = lazy(() => import('./Talentino'));
const Settings = lazy(() => import('./Settings'));
const Clients = lazy(() => import('./Clients'));
const CertificateSign = lazy(() => import('./CertificateSign'));
const UserManagement = lazy(() => import('./UserManagement'));
const StudyMaterials = lazy(() => import('./StudyMaterials'));
const TechnicalExams = lazy(() => import('./TechnicalExams'));
const Aptitude = lazy(() => import('./Aptitude'));
const TalentinoExams = lazy(() => import('./TalentinoExams'));
const Courses = lazy(() => import('./Courses'));
const PlacementDrives = lazy(() => import('./PlacementDrives'));
const ExamsHub = lazy(() => import('./ExamsHub'));
const Branches = lazy(() => import('./Branches'));
const TrainerLog = lazy(() => import('./TrainerLog'));
const SecurityActivity = lazy(() => import('./SecurityActivity'));
const PublicSitePage = lazy(() => import('./PublicSitePage'));

// ASSET MANAGEMENT (ERP)
const AssetList = lazy(() => import('./AssetList'));
const AddAsset = lazy(() => import('./AddAsset'));
const Inventory = lazy(() => import('./Inventory'));
const AssetTransfers = lazy(() => import('./AssetTransfers'));
const AssetMaintenance = lazy(() => import('./AssetMaintenance'));
const AssetDashboard = lazy(() => import('./AssetDashboard'));
const AssetSettings = lazy(() => import('./AssetSettings'));

// MEDIA & DESIGN PORTAL
const MediaTasks = lazy(() => import('./MediaTasks'));
const MediaPreview = lazy(() => import('./MediaPreview'));
const MediaFiles = lazy(() => import('./MediaFiles'));
const MediaCategories = lazy(() => import('./MediaCategories'));
const MediaSocial = lazy(() => import('./MediaSocial'));
const MediaLogs = lazy(() => import('./MediaLogs'));
const MediaSettings = lazy(() => import('./MediaSettings'));

// ACADEMIC & TRAINING ERP
const AcademicTraining = lazy(() => import('./AcademicTraining'));
const AcademicBatches = lazy(() => import('./AcademicBatches'));
const AcademicSessions = lazy(() => import('./AcademicSessions'));
const AcademicAttendance = lazy(() => import('./AcademicAttendance'));
const AcademicDiary = lazy(() => import('./AcademicDiary'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div role="status" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f6f8fb', color: '#263746', fontFamily: 'Inter, sans-serif' }}>Loading IPCS workspace…</div>}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<PublicSitePage page="about" />} />
        <Route path="/placements" element={<PublicSitePage page="placement" />} />
        <Route path="/partners" element={<PublicSitePage page="partners" />} />
        <Route path="/updates" element={<PublicSitePage page="updates" />} />
        <Route path="/recruiter" element={<RecruiterMOU />} />
        <Route path="/dashboard" element={<Dashboard />} />
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
        <Route path="/trainer-logs" element={<TrainerLog />} />
        <Route path="/exams" element={<ExamsHub />} />
        <Route path="/exams/technical" element={<TechnicalExams />} />
        <Route path="/exams/aptitude" element={<Aptitude />} />
        <Route path="/exams/talentino" element={<TalentinoExams />} />
        <Route path="/security-logs" element={<SecurityActivity />} />
        
        {/* ASSET MANAGEMENT ERP ROUTES */}
        <Route path="/assets" element={<AssetList />} />
        <Route path="/assets/add" element={<AddAsset />} />
        <Route path="/assets/inventory" element={<Inventory />} />
        <Route path="/assets/transfers" element={<AssetTransfers />} />
        <Route path="/assets/maintenance" element={<AssetMaintenance />} />
        <Route path="/assets/dashboard" element={<AssetDashboard />} />
        <Route path="/assets/settings" element={<AssetSettings />} />

        {/* MODULAR MEDIA & DESIGN PORTAL ROUTES */}
        <Route path="/media/dashboard" element={<MediaTasks />} />
        <Route path="/media/preview" element={<MediaPreview />} />
        <Route path="/media/files" element={<MediaFiles />} />
        <Route path="/media/categories" element={<MediaCategories />} />
        <Route path="/media/social" element={<MediaSocial />} />
        <Route path="/media/logs" element={<MediaLogs />} />
        <Route path="/media/settings" element={<MediaSettings />} />

        {/* MODULAR ACADEMIC & TRAINING ROUTES */}
        <Route path="/academic/training" element={<AcademicTraining />} />
        <Route path="/academic/batches" element={<AcademicBatches />} />
        <Route path="/academic/sessions" element={<AcademicSessions />} />
        <Route path="/academic/attendance" element={<AcademicAttendance />} />
        <Route path="/academic/diary" element={<AcademicDiary />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
