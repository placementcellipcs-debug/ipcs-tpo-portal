import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell, X, SquaresFour, Trophy, ListChecks, Headset, 
  UserCheck, Gear, Users, Briefcase, Files, CalendarStar, ChartBar, Handshake,
  Book, FileText, Brain, PencilSimple, Bookmarks, ShieldCheck
} from '@phosphor-icons/react';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [tpoData] = useState(() => {
    try {
      const data = localStorage.getItem('tpoData');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  });
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!tpoData) navigate('/');
    // Enforce Dark Mode Permanently
    document.body.setAttribute('data-theme', 'dark');
  }, [tpoData, navigate]);

  if (!tpoData) return null;

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
    if (!profilePhotoUrl || profilePhotoUrl === 'N/A' || imgError) {
      return <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ffffff' }}>{initial}</span>;
    }
    return (
      <img 
        src={profilePhotoUrl} 
        alt="Profile" 
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        onError={() => setImgError(true)} 
      />
    );
  };

  return (
    <div className="app-layout">
      <main className="main-content">
        
        <header className="top-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <div className="header-left">
            <img 
              src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" 
              alt="IPCS Logo" 
              style={{ height: '35px', objectFit: 'contain' }} 
              onError={(e) => { 
                e.currentTarget.onerror = null; 
                e.currentTarget.src = 'https://ipcsglobal.com/wp-content/uploads/2023/12/IPCS-Global-Logo-1.png'; 
              }}
            />
          </div>
          <div className="header-actions">
            <button className="icon-btn" title="Notifications"><Bell weight="fill" /></button>
            {/* Removed the extra SignOut button and Theme Toggle here */}
            <div className="header-profile" onClick={() => setIsDrawerOpen(true)}>
              <div className="header-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
                {renderAvatar()}
              </div>
            </div>
          </div>
        </header>

        <div className="page-container" style={{ width: '100%', overflowX: 'hidden' }}>
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
            
            {/* 🚨 JOB TRACKER: Strictly limited to TPOs ONLY */}
            {(tpoData.role || '').toUpperCase() === 'TPO' && (
              <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/tracker'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Files size={22} color={isActive('/tracker')} /> Job Tracker</div><span>›</span></div>
            )}

            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/placed'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Trophy size={22} color={isActive('/placed')} /> Placed Students</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/applications'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ListChecks size={22} color={isActive('/applications')} /> Student Apps</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/vacancies'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Briefcase size={22} color={isActive('/vacancies')} /> Vacancies</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/clients'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Handshake size={22} color={isActive('/clients')} /> Clients & Partners</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/events'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><CalendarStar size={22} color={isActive('/events')} /> Events</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/issues'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Headset size={22} color={isActive('/issues')} /> Issues</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/reports'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ChartBar size={22} color={isActive('/reports')} /> Reports</div><span>›</span></div>
            <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/talentino'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><UserCheck size={22} color={isActive('/talentino')} /> Talentino</div><span>›</span></div>
            
            {(tpoData.accessType === 'superadmin' || (tpoData.role || '').toUpperCase().includes('RTH')) && (
               <>
                 <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/study-materials'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Book size={22} color={isActive('/study-materials')} /> Study Materials</div><span>›</span></div>
                 <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/exams'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><FileText size={22} color={isActive('/exams')} /> Technical Exams</div><span>›</span></div>
                 <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/aptitude'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Brain size={22} color={isActive('/aptitude')} /> Aptitude Exams</div><span>›</span></div>
                 <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/talentino-exams'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><PencilSimple size={22} color={isActive('/talentino-exams')} /> Talentino Exams</div><span>›</span></div>
               </>
            )}

            {tpoData.accessType === 'superadmin' && (
               <>
                 <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/courses'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Bookmarks size={22} color={isActive('/courses')} /> Manage Courses</div><span>›</span></div>
                 <div className="drawer-item" onClick={() => { setIsDrawerOpen(false); navigate('/users'); }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ShieldCheck size={22} color={isActive('/users')} /> User Management</div><span>›</span></div>
               </>
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