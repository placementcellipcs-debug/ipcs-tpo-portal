import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import StudentsDirectory from './StudentsDirectory';
import JobTracker from './JobTracker';
import PlacedStudents from './PlacedStudents';
import StudentApps from './StudentApps';
import Vacancies from './Vacancies';
import Events from './Events';
import Issues from './Issues';
import Reports from './Reports';
import Talentino from './Talentino';
import Settings from './Settings';
import Clients from './Clients';
import CertificateSign from './CertificateSign';
import UserManagement from './UserManagement';
import StudyMaterials from './StudyMaterials';
import TechnicalExams from './TechnicalExams';

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
        <Route path="/issues" element={<Issues />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/talentino" element={<Talentino />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/sign-certificate/:id" element={<CertificateSign />} />
        <Route path="/users" element={<UserManagement />} />
        
        {/* 🚨 NEW ROUTES */}
        <Route path="/study-materials" element={<StudyMaterials />} />
        <Route path="/exams" element={<TechnicalExams />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;