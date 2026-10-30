import { useNavigate, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { Brain, Buildings, CalendarCheck, ChalkboardTeacher, ClipboardText, GraduationCap, Notebook, BookOpen, SquaresFour, UsersFour } from '@phosphor-icons/react';
import { getTrainerAssignments } from './academicScope';
import './AcademicTopNav.css';

export default function AcademicTopNav({ title, subtitle, statLabel, statValue }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const account = useMemo(() => { try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { return {}; } }, []);
  const { branches, courses } = getTrainerAssignments(account);

  const tabs = [
    { name: 'Dashboard', path: '/academic', icon: <SquaresFour size={20} /> },
    { name: 'Mind Gym', path: '/academic/brain-gym', icon: <Brain size={20} /> },
    { name: 'Branches', path: '/academic/branches', icon: <Buildings size={20} /> },
    { name: 'Leave approvals', path: '/academic/leaves', icon: <ClipboardText size={20} /> },
    { name: 'Student Training', path: '/academic/training', icon: <GraduationCap size={20} /> },
    { name: 'Batches', path: '/academic/batches', icon: <UsersFour size={20} /> },
    { name: 'Daily Sessions', path: '/academic/sessions', icon: <ChalkboardTeacher size={20} /> },
    { name: 'Attendance', path: '/academic/attendance', icon: <CalendarCheck size={20} /> },
    { name: 'Syllabus & Topics', path: '/academic/topics', icon: <BookOpen size={20} /> },
    { name: 'Digital Diary', path: '/academic/diary', icon: <Notebook size={20} /> }
  ];

  return (
    <header className="academic-portal-header">
      <div className="academic-portal-hero">
        <div className="academic-portal-hero-copy">
          <div className="academic-portal-eyebrow"><span className="academic-live-dot" /> TRAINER LEARNING STUDIO <span className="academic-eyebrow-divider" /> {account.name || 'Trainer'}</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          <div className="academic-scope-row">
            <span className="academic-scope-label">YOUR SCOPE</span>
            <span className="academic-scope-chip course"><BookOpen size={14} /> {courses.length ? courses.join(' · ') : 'Course assignment pending'}</span>
            <span className="academic-scope-chip branches"><Buildings size={14} /> {branches.length ? branches.join(' · ') : 'Branch assignment pending'}</span>
          </div>
        </div>
        {statLabel && <div className="academic-hero-stat"><span>{statLabel}</span><strong>{statValue}</strong><small>IN YOUR ASSIGNED SCOPE</small></div>}
        <div className="academic-hero-orb orb-one" /><div className="academic-hero-orb orb-two" />
      </div>

      <div className="academic-slider-shell">
        <div className="academic-slider-caption"><span>WORKSPACE</span><small>Move between your teaching tools</small></div>
        <nav className="academic-tab-slider" aria-label="Training and Academics tabs">
          {tabs.map((tab, index) => {
            const isActive = currentPath === tab.path || (tab.path === '/academic' && currentPath === '/academic/');
            return <button key={tab.name} type="button" className={`academic-slider-tab${isActive ? ' active' : ''} tab-tone-${index}`} aria-current={isActive ? 'page' : undefined} onClick={() => navigate(tab.path)}>
              <span className="academic-tab-icon">{tab.icon}</span><span className="academic-tab-name">{tab.name}</span><small>{String(index + 1).padStart(2, '0')}</small>
            </button>;
          })}
        </nav>
      </div>
    </header>
  );
}
