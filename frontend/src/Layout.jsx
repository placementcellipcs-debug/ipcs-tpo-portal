import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  SignOut, Bell, Moon, Sun, X, SquaresFour, Trophy, ListChecks, Headset, 
  UserCheck, Gear, Users, Briefcase, Files, CalendarStar, ChartBar, Handshake,
  ShieldCheck, BookOpenText, Exam
} from '@phosphor-icons/react';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Safely parse localStorage to prevent app crashes on malformed data
  const [tpoData] = useState(() => {
    try {
      const data = localStorage.getItem('tpoData');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to parse tpoData from localStorage", error);
      return null;
    }
  });
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(document.body.getAttribute('data-theme') || 'dark');
  const [imgError, setImgError] = useState(false); // Proper React state for broken images

  useEffect(() => {
    if (!tpoData) navigate('/');
  }, [tpoData, navigate]);

  if (!tpoData) return null;

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    setTheme(newTheme);
  };

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };
  
  const profilePhotoUrl = getDriveImage(tpoData.photo);
  const isActive = (path) => location.pathname === path ? 'var(--accent-primary)' : 'var(--text-muted)';

  const handleLogout = () => {
    localStorage.removeItem('tpoData');
    navigate('/');
  };

  const renderAvatar = () => {
    const initial = tpoData.name ? String(tpoData.name).charAt(0).toUpperCase() : '?';
    
    // Safely fallback to text initial if no image URL or if the image failed to load
    if (!profilePhotoUrl || profilePhotoUrl === 'N/A' || imgError) {
      return <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{initial}</span>;
    }
    
    return (
      <img 
        src={profilePhotoUrl} 
        alt="Profile" 
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        onError={() => setImgError(true)} // Safely update state instead of mutating DOM
      />
    );
  };

  return (
    <div className="app-layout">
      <main className="main-content">
        
        <header className="top-header">
          <div className="header-left">
            <img 
              src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" 
              alt="IPCS Logo" 
              style={{ height: '35px', objectFit: 'contain' }} 
              onError={(e) => { 
                e.currentTarget.onerror = null; // Prevents infinite loop if fallback fails
                e.currentTarget.src = 'https://ipcsglobal.com/wp-content/uploads/2023/12/IPCS-Global-Logo-1.png'; 
              }}
            />
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={toggleTheme} title="Dark/Light Mode">
              {theme === 'dark' ? <Moon weight="fill" /> : <Sun weight="fill" />}
            </button>
            <button className="icon-btn" title="Notifications"><Bell weight="fill" /></button>
            <button className="icon-btn" onClick={handleLogout} style={{ color: '#ef4444', marginLeft: '10px' }} title="Logout"><SignOut weight="fill" /></button>
            <div className="header-profile" onClick={() => setIsDrawerOpen(true)}>
              <div className="header-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
                {renderAvatar()}
              </div>
            </div>
          </div>
        </header>

        <div className="page-container">
          {children}
        </div>

      </main>

      <div 
        className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} 
        onClick={(e) => { if(e.target.classList.contains('drawer-overlay')) setIsDrawerOpen(false); }}
      >
        <div className="drawer-card">
          <div className="drawer-header">
            <div className="drawer-close-btn" onClick={() => setIsDrawerOpen(false)}><X size={16} /></div>
            <div className="drawer-profile-row">
              <div className="drawer-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
                {renderAvatar()}
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700 }}>{tpoData.name}</strong>
                <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{tpoData.role || 'Placement Officer'}</span>
              </div>
            </div>
          </div>
          
          <div className="drawer-menu">
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/dashboard'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><SquaresFour size={22} color={isActive('/dashboard')} /> Dashboard</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/students'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Users size={22} color={isActive('/students')} /> Students Directory</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/tracker'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Files size={22} color={isActive('/tracker')} /> Job Tracker</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/placed'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Trophy size={22} color={isActive('/placed')} /> Placed Students</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/applications'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ListChecks size={22} color={isActive('/applications')} /> Student Apps</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/vacancies'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Briefcase size={22} color={isActive('/vacancies')} /> Vacancies</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/clients'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Handshake size={22} color={isActive('/clients')} /> Clients & Partners</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/events'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><CalendarStar size={22} color={isActive('/events')} /> Events</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/issues'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Headset size={22} color={isActive('/issues')} /> Issues</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/reports'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ChartBar size={22} color={isActive('/reports')} /> Reports</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/talentino'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><UserCheck size={22} color={isActive('/talentino')} /> Talentino</div><span>›</span></div>
            
            {/* 🚨 STUDY MATERIALS & EXAM TABS (Safe Icons) */}
            {(tpoData.accessType === 'superadmin' || (tpoData.role || '').toUpperCase().includes('RTH')) && (
               <>
                 <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/study-materials'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><BookOpenText size={22} color={isActive('/study-materials')} /> Study Materials</div><span>›</span></div>
                 <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/exams'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><FileText size={22} color={isActive('/exams')} /> Technical Exams</div><span>›</span></div>
               </>
            )}

            {tpoData.accessType === 'superadmin' && (
               <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/users'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ShieldCheck size={22} color={isActive('/users')} /> User Management</div><span>›</span></div>
            )}

            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/settings'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Gear size={22} color={isActive('/settings')} /> Settings</div><span>›</span></div>
          </div>
          
          <div className="drawer-footer">
            <button className="btn-logout-drawer" onClick={handleLogout}>Log Out</button>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>Copyright © 2026 IPCS Global</div>
          </div>
        </div>
      </div>
    </div>
  );
}