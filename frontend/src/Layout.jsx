import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell, X, SquaresFour, Trophy, ListChecks, 
  UserCheck, Gear, Users, Briefcase, Files, CalendarStar, ChartBar, Handshake,
  Book, FileText, Bookmarks, ShieldCheck, IdentificationCard, CaretLeft, MapPin
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
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!tpoData) navigate('/');
    document.body.setAttribute('data-theme', 'dark');
  }, [tpoData, navigate]);

  if (!tpoData) return null;

  const userRole = (tpoData.role || '').toUpperCase();
  const isSuperAdmin = tpoData.accessType === 'superadmin' || userRole.includes('ADMIN') || userRole.includes('HEAD') || userRole.includes('MANAGER');
  const showReports = isSuperAdmin || userRole === 'TPO';

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };
  
  const profilePhotoUrl = getDriveImage(tpoData.photo);
  
  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return '#38bdf8';
    if (path !== '/dashboard' && location.pathname.startsWith(path)) return '#38bdf8';
    return '#94a3b8';
  };

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
      <img src={profilePhotoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} />
    );
  };

  const handleNav = (path) => {
    setIsDrawerOpen(false);
    navigate(path);
  };

  return (
    <div className="app-layout">
      
      <main className="main-content">
        <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px' }}>
          <div className="header-left">
            <img src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" alt="IPCS Logo" style={{ height: '35px', objectFit: 'contain' }} />
          </div>
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" title="Notifications" onClick={() => setIsNotifOpen(!isNotifOpen)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                <Bell size={24} weight="fill" />
                <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', border: '2px solid var(--bg-dark)' }}></span>
              </button>

              {isNotifOpen && (
                <div style={{ position: 'absolute', top: '40px', right: '0', background: '#0f1523', border: '1px solid #1e293b', borderRadius: '12px', width: '320px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 9999, overflow: 'hidden' }}>
                  <div style={{ padding: '15px', borderBottom: '1px solid #1e293b', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
                    Notifications
                    <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '3px 8px', borderRadius: '10px' }}>System Active</span>
                  </div>
                  <div style={{ padding: '0', maxHeight: '300px', overflowY: 'auto' }}>
                    <div style={{ padding: '15px', display: 'flex', gap: '12px' }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Trophy size={18} weight="bold" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold', marginBottom: '3px' }}>Data Synced Successfully</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>All dashboard charts are now reflecting real-time data from Google Sheets.</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '5px' }}>Just now</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="header-profile" onClick={() => setIsDrawerOpen(true)} style={{ cursor: 'pointer' }}>
              <div className="header-avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-border)', border: '2px solid rgba(255,255,255,0.1)' }}>
                {renderAvatar()}
              </div>
            </div>
          </div>
        </header>

        <div className="page-container" style={{ padding: '20px 30px', position: 'relative' }} onClick={() => setIsNotifOpen(false)}>
          {location.pathname !== '/dashboard' && (
            <div style={{ marginBottom: '25px' }}>
              <button 
                onClick={() => navigate('/dashboard')}
                style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s' }}
              >
                <CaretLeft weight="bold" size={16} /> Back to Dashboard
              </button>
            </div>
          )}
          {children}
        </div>
      </main>

      <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={(e) => { if(e.target.classList.contains('drawer-overlay')) setIsDrawerOpen(false); }}>
        <div className="drawer-card" style={{ backgroundImage: `linear-gradient(rgba(11, 17, 32, 0.85), rgba(11, 17, 32, 0.98)), url('https://lh3.googleusercontent.com/d/1dr27VR3Xu8EwDf4dCAO1ucq441VjpfwB')`, backgroundSize: 'cover', backgroundPosition: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', height: '100%' }}>
          
          <div className="drawer-header" style={{ padding: '30px 20px', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
            <div className="drawer-close-btn" onClick={() => setIsDrawerOpen(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} weight="bold" /></div>
            <div className="drawer-profile-row" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div className="drawer-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0 }}>{renderAvatar()}</div>
              <div style={{ color: '#fff' }}>
                <strong style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.5px' }}>{tpoData.name}</strong>
                <span style={{ fontSize: '0.75rem', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px', color: '#cbd5e1' }}>{tpoData.role || 'Placement Officer'}</span>
              </div>
            </div>
          </div>
          
          <div className="drawer-menu" style={{ padding: '15px', flex: 1, overflowY: 'auto' }}>
            <div className="drawer-item" onClick={() => handleNav('/dashboard')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><SquaresFour size={22} color={isActive('/dashboard')} /> <span style={{ color: isActive('/dashboard') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Dashboard</span></div><span style={{ color: '#64748b' }}>›</span></div>
            <div className="drawer-item" onClick={() => handleNav('/students')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Users size={22} color={isActive('/students')} /> <span style={{ color: isActive('/students') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Students Directory</span></div><span style={{ color: '#64748b' }}>›</span></div>
            
            {showReports && (
              <>
                <div className="drawer-item" onClick={() => handleNav('/tracker')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Files size={22} color={isActive('/tracker')} /> <span style={{ color: isActive('/tracker') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Job Tracker</span></div><span style={{ color: '#64748b' }}>›</span></div>
                <div className="drawer-item" onClick={() => handleNav('/reports')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ChartBar size={22} color={isActive('/reports')} /> <span style={{ color: isActive('/reports') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Reports</span></div><span style={{ color: '#64748b' }}>›</span></div>
              </>
            )}

            <div className="drawer-item" onClick={() => handleNav('/placed')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Trophy size={22} color={isActive('/placed')} /> <span style={{ color: isActive('/placed') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Placed Students</span></div><span style={{ color: '#64748b' }}>›</span></div>
            <div className="drawer-item" onClick={() => handleNav('/applications')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ListChecks size={22} color={isActive('/applications')} /> <span style={{ color: isActive('/applications') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Student Apps</span></div><span style={{ color: '#64748b' }}>›</span></div>
            <div className="drawer-item" onClick={() => handleNav('/vacancies')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Briefcase size={22} color={isActive('/vacancies')} /> <span style={{ color: isActive('/vacancies') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Vacancies</span></div><span style={{ color: '#64748b' }}>›</span></div>
            <div className="drawer-item" onClick={() => handleNav('/placement-drives')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><IdentificationCard size={22} color={isActive('/placement-drives')} /> <span style={{ color: isActive('/placement-drives') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Placement Drives</span></div><span style={{ color: '#64748b' }}>›</span></div>
            <div className="drawer-item" onClick={() => handleNav('/clients')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Handshake size={22} color={isActive('/clients')} /> <span style={{ color: isActive('/clients') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Clients & Partners</span></div><span style={{ color: '#64748b' }}>›</span></div>
            <div className="drawer-item" onClick={() => handleNav('/events')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><CalendarStar size={22} color={isActive('/events')} /> <span style={{ color: isActive('/events') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Events</span></div><span style={{ color: '#64748b' }}>›</span></div>
            <div className="drawer-item" onClick={() => handleNav('/talentino')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><UserCheck size={22} color={isActive('/talentino')} /> <span style={{ color: isActive('/talentino') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Talentino</span></div><span style={{ color: '#64748b' }}>›</span></div>
            
            {(isSuperAdmin || userRole.includes('RTH')) && (
               <>
                 <div className="drawer-item" onClick={() => handleNav('/study-materials')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Book size={22} color={isActive('/study-materials')} /> <span style={{ color: isActive('/study-materials') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Study Materials</span></div><span style={{ color: '#64748b' }}>›</span></div>
                 <div className="drawer-item" onClick={() => handleNav('/exams')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><FileText size={22} color={isActive('/exams')} /> <span style={{ color: isActive('/exams') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Exams Hub</span></div><span style={{ color: '#64748b' }}>›</span></div>
               </>
            )}

            {isSuperAdmin && (
               <>
                 <div className="drawer-item" onClick={() => handleNav('/branches')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><MapPin size={22} color={isActive('/branches')} /> <span style={{ color: isActive('/branches') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Manage Branches</span></div><span style={{ color: '#64748b' }}>›</span></div>
                 <div className="drawer-item" onClick={() => handleNav('/courses')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Bookmarks size={22} color={isActive('/courses')} /> <span style={{ color: isActive('/courses') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Manage Courses</span></div><span style={{ color: '#64748b' }}>›</span></div>
                 <div className="drawer-item" onClick={() => handleNav('/users')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ShieldCheck size={22} color={isActive('/users')} /> <span style={{ color: isActive('/users') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>User Management</span></div><span style={{ color: '#64748b' }}>›</span></div>
               </>
            )}

            <div className="drawer-item" onClick={() => handleNav('/settings')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Gear size={22} color={isActive('/settings')} /> <span style={{ color: isActive('/settings') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Settings</span></div><span style={{ color: '#64748b' }}>›</span></div>
          </div>
          
          <div className="drawer-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '20px', flexShrink: 0 }}>
            <button className="btn-logout-drawer" onClick={handleLogout} style={{ width: '100%', padding: '10px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Log Out</button>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '12px', textAlign: 'center' }}>Copyright © 2026 IPCS Global</div>
          </div>
        </div>
      </div>
    </div>
  );
}