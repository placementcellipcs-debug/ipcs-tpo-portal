import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import StudentsDirectory from './StudentsDirectory';
import JobTracker from './JobTracker';
import PlacedStudents from './PlacedStudents';
import StudentApps from './StudentApps';
import Vacancies from './Vacancies';
import Events from './Events';
import Reports from './Reports';
import Talentino from './Talentino';
import Settings from './Settings';
import Clients from './Clients';
import CertificateSign from './CertificateSign';
import UserManagement from './UserManagement';
import StudyMaterials from './StudyMaterials';
import TechnicalExams from './TechnicalExams';
import Aptitude from './Aptitude';
import TalentinoExams from './TalentinoExams';
import Courses from './Courses';
import PlacementDrives from './PlacementDrives';
import ExamsHub from './ExamsHub';
import Branches from './Branches'; // 🚨 NEW IMPORT

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/students" element={<StudentsDirectory />} />
        <Route path="/tracker" element={<JobTracker />} />
        <Route path="/placed" element={<PlacedStudents />} />
        <Route path="/applications" element={<StudentApps />} />
        <Route path="/vacancies" element={<Vacancies />} />
        <Route path="/events" element={<Events />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/talentino" element={<Talentino />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/sign-certificate/:id" element={<CertificateSign />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/study-materials" element={<StudyMaterials />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/placement-drives" element={<PlacementDrives />} />
        
        {/* 🚨 THE NEW BRANCHES ROUTE */}
        <Route path="/branches" element={<Branches />} />

        <Route path="/exams" element={<ExamsHub />} />
        <Route path="/exams/technical" element={<TechnicalExams />} />
        <Route path="/exams/aptitude" element={<Aptitude />} />
        <Route path="/exams/talentino" element={<TalentinoExams />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;