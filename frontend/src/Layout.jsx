import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion'; // 🚨 PREMIUM UX: Framer Motion added
import { 
  Bell, X, SquaresFour, Trophy, ListChecks, ShieldCheck,
  UserCheck, Gear, Users, Briefcase, Files, CalendarStar, ChartBar, Handshake,
  Book, FileText, Bookmarks, IdentificationCard, CaretLeft, MapPin,
  WarningCircle, Notebook, Barcode, Package, ArrowsLeftRight, Wrench, Plus,
  MagnifyingGlass // 🚨 PREMIUM UX: Search icon added
} from '@phosphor-icons/react';
import { API_BASE } from './apiConfig';

const getStandardCourse = (c) => {
  if (!c) return 'Others';
  const lower = c.toLowerCase().trim();
  if (lower.includes('bms') || lower.includes('cctv')) return 'BMS AND CCTV';
  if (lower.includes('automation') || lower.includes('plc') || lower.includes('scada')) return 'Industrial Automation';
  if (lower.includes('embed') || lower.includes('iot')) return 'Embedded and IoT';
  if (lower.includes('digital') || lower.includes('dm') || lower.includes('marketing')) return 'Digital Marketing';
  if (lower.includes('it') || lower.includes('python') || lower.includes('software') || lower.includes('data')) return 'Information technology (IT)';
  return 'Others';
};

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [tpoData] = useState(() => {
    try {
      const data = localStorage.getItem('tpoData');
      return data ? JSON.parse(data) : null;
    } catch (error) { return null; }
  });
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // 🚨 PREMIUM UX: COMMAND PALETTE STATE
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [cmdSearch, setCmdSearch] = useState('');
  const searchInputRef = useRef(null);

  // 🚨 PREMIUM UX: THEME ENGINE STATE
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'dark');
  const [accent, setAccent] = useState(() => localStorage.getItem('app_accent') || 'cyan');

  // Apply Theme & Accent to Document Body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.body.setAttribute('data-accent', accent);
    localStorage.setItem('app_accent', accent);
  }, [accent]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // 🚨 PREMIUM UX: COMMAND PALETTE KEYBOARD LISTENER (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isCmdOpen) {
        setIsCmdOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCmdOpen]);

  // Auto-focus the search bar when the palette opens
  useEffect(() => {
    if (isCmdOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setCmdSearch('');
    }
  }, [isCmdOpen]);

  useEffect(() => {
    if (!tpoData) {
      navigate('/');
      return;
    }

    const INACTIVITY_TIMEOUT = 15 * 60 * 1000; 
    let lastActivity = Date.now();
    const handleUserInteraction = () => { lastActivity = Date.now(); };
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    const inactivityInterval = setInterval(() => {
      if (Date.now() - lastActivity >= INACTIVITY_TIMEOUT) {
        clearInterval(inactivityInterval);
        activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
        localStorage.removeItem('tpoData');
        alert("Session Expired: You have been logged out due to 15 minutes of inactivity.");
        window.location.href = '/';
      }
    }, 10000);

    const sessionHeartbeat = setInterval(async () => {
      try {
        if (!tpoData?.email || !tpoData?.sessionToken) return;
        const res = await axios.post(`${API_BASE}/api/auth/verify-session`, {
          email: tpoData.email,
          sessionToken: tpoData.sessionToken
        });
        if (res.data && res.data.valid === false) {
          clearInterval(sessionHeartbeat);
          clearInterval(inactivityInterval);
          activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
          localStorage.removeItem('tpoData');
          alert("Security Notice: " + (res.data.message || "Your account was logged in on another device."));
          window.location.href = '/';
        }
      } catch (err) {}
    }, 30000);

    return () => {
      clearInterval(inactivityInterval);
      clearInterval(sessionHeartbeat);
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
    };
  }, [tpoData, navigate]);

  useEffect(() => {
    if (!tpoData) return;
    
    const userRole = (tpoData?.role || '').toUpperCase();
    const isSuperAdmin = tpoData?.accessType === 'superadmin' || userRole.includes('GENERAL MANAGER') || userRole.includes('ZONAL PLACEMENT HEAD') || userRole === 'TECHNICAL HEAD';
    const isCourseSpecific = userRole.includes('RTH') || userRole.includes('TTH') || userRole.includes('TRAINER') || userRole.includes('TECHNICAL LEAD');
    const myCourse = getStandardCourse(tpoData?.assignedCourse);

    try {
      const logsStr = localStorage.getItem('dash_logs');
      if (logsStr) {
        const logs = JSON.parse(logsStr);
        const sorted = logs.sort((a,b) => new Date(b.TimeStamp || b.Timestamp || b['Time Stamp'] || 0) - new Date(a.TimeStamp || a.Timestamp || a['Time Stamp'] || 0)).slice(0, 20); 
        
        const mappedNotifs = sorted.map(log => {
          const getVal = (s) => {
             const key = Object.keys(log).find(k => k.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, '')));
             return key ? log[key] : '';
          };
          const name = getVal('name') || getVal('student') || 'Student';
          const company = getVal('company');
          const status = (getVal('status') || '').toLowerCase();
          const courseRaw = getVal('course');
          
          let title = "Application Updated";
          let desc = `${name}'s status updated to ${getVal('status') || 'Applied'} at ${company}.`;
          let icon = <ListChecks size={18} weight="bold" />;
          let color = "#38bdf8"; let bg = "rgba(56, 189, 248, 0.1)";

          if (status.includes('placed') || status.includes('offer')) {
             title = "Placement Confirmed! 🎉"; desc = `${name} has been successfully placed at ${company}!`;
             icon = <Trophy size={18} weight="bold" />; color = "#10b981"; bg = "rgba(16, 185, 129, 0.1)";
          } else if (status.includes('interview')) {
             title = "Interview Scheduled"; desc = `An interview is scheduled for ${name} at ${company}.`;
             icon = <CalendarStar size={18} weight="bold" />; color = "#a855f7"; bg = "rgba(168, 85, 247, 0.1)";
          } else if (status.includes('reject') || status.includes('not attend') || status.includes('hold')) {
             title = "Action Alert"; desc = `Status changed to '${getVal('status')}' for ${name}.`;
             icon = <WarningCircle size={18} weight="bold" />; color = "#ef4444"; bg = "rgba(239, 68, 68, 0.1)";
          }
          return { title, desc, icon, color, bg, time: getVal('timestamp') || 'Recently', courseRaw };
        });

        const finalNotifs = mappedNotifs.filter(n => {
          if (isSuperAdmin || userRole.includes('TPO') || userRole.includes('MANAGER')) return true;
          if (isCourseSpecific) return getStandardCourse(n.courseRaw) === myCourse;
          return true;
        }).slice(0, 5); 

        setNotifications(finalNotifs);
      }
    } catch(e) { console.error("Error parsing notifications"); }
  }, [tpoData]);

  if (!tpoData) return null;

  const userRole = (tpoData.role || '').toUpperCase();
  const isSuperAdmin = tpoData.accessType === 'superadmin' || userRole.includes('GENERAL MANAGER') || userRole.includes('ZONAL PLACEMENT HEAD') || userRole === 'TECHNICAL HEAD';
  const isTpo = userRole.includes('TPO');
  const isTrainer = userRole.includes('TRAINER');
  const isRth = userRole.includes('RTH') || userRole.includes('REGIONAL TECHNICAL HEAD');
  const isTL = userRole.includes('TECHNICAL LEAD') || userRole.includes('TTH') || isRth || userRole.includes('MANAGER') || isSuperAdmin;

  const showTracker = isTpo && !isSuperAdmin; 
  const showReports = isSuperAdmin || isTpo; 
  const showManageAdmin = isSuperAdmin;
  const showStudyMaterials = isSuperAdmin || isRth || userRole.includes('TTH') || userRole.includes('TECHNICAL LEAD') || isTrainer; 
  const showTrainerLogs = isTrainer || isTL;
  const showStudentApps = isTpo && !isSuperAdmin;

  // 🚨 PREMIUM UX: DYNAMIC ROLE-BASED ROUTES FOR COMMAND PALETTE
  const getAccessibleRoutes = () => {
    const routes = [
      { name: 'Dashboard', path: '/dashboard', icon: <SquaresFour size={20} /> },
      { name: 'Students Directory', path: '/students', icon: <Users size={20} /> },
      { name: 'Placed Students', path: '/placed', icon: <Trophy size={20} /> },
      { name: 'Vacancies', path: '/vacancies', icon: <Briefcase size={20} /> },
      { name: 'Events', path: '/events', icon: <CalendarStar size={20} /> },
      { name: 'Talentino', path: '/talentino', icon: <UserCheck size={20} /> },
      { name: 'Settings', path: '/settings', icon: <Gear size={20} /> }
    ];
    if (showTracker) routes.push({ name: 'Job Tracker', path: '/tracker', icon: <Files size={20} /> });
    if (showReports) routes.push({ name: 'Reports', path: '/reports', icon: <ChartBar size={20} /> });
    if (showStudentApps) routes.push({ name: 'Student Apps', path: '/applications', icon: <ListChecks size={20} /> });
    if (!isTrainer) routes.push({ name: 'Placement Drives', path: '/placement-drives', icon: <IdentificationCard size={20} /> });
    if (!isTrainer) routes.push({ name: 'Clients & Partners', path: '/clients', icon: <Handshake size={20} /> });
    if (showStudyMaterials) routes.push({ name: 'Study Materials', path: '/study-materials', icon: <Book size={20} /> });
    if (showTrainerLogs) routes.push({ name: 'Daily Log Report', path: '/trainer-logs', icon: <Notebook size={20} /> });
    if (!userRole.includes('MANAGER') && !isTpo) routes.push({ name: 'Exams Hub', path: '/exams', icon: <FileText size={20} /> });
    
    if (isSuperAdmin || userRole.includes('MANAGER')) {
       routes.push({ name: 'Asset Dashboard', path: '/assets/dashboard', icon: <ChartBar size={20} /> });
       routes.push({ name: 'Asset Master Registry', path: '/assets', icon: <Barcode size={20} /> });
       routes.push({ name: 'Register Asset', path: '/assets/add', icon: <Plus size={20} /> });
       routes.push({ name: 'Asset Consumables', path: '/assets/inventory', icon: <Package size={20} /> });
       routes.push({ name: 'Asset Transfers', path: '/assets/transfers', icon: <ArrowsLeftRight size={20} /> });
       routes.push({ name: 'Asset Maintenance', path: '/assets/maintenance', icon: <Wrench size={20} /> });
    }
    if (showManageAdmin) {
       routes.push({ name: 'Manage Branches', path: '/branches', icon: <MapPin size={20} /> });
       routes.push({ name: 'Manage Courses', path: '/courses', icon: <Bookmarks size={20} /> });
       routes.push({ name: 'User Management', path: '/users', icon: <ShieldCheck size={20} /> });
       routes.push({ name: 'Security Logs', path: '/security-logs', icon: <ShieldCheck size={20} /> });
    }
    return routes;
  };

  const filteredRoutes = getAccessibleRoutes().filter(route => 
    route.name.toLowerCase().includes(cmdSearch.toLowerCase())
  );

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };
  
  const profilePhotoUrl = getDriveImage(tpoData.photo);
  const isActive = (path) => location.pathname.startsWith(path) ? '#38bdf8' : '#94a3b8';

  const handleLogout = () => { localStorage.removeItem('tpoData'); navigate('/'); };
  
  const handleNav = (path) => { 
    setIsDrawerOpen(false); 
    setIsCmdOpen(false); 
    navigate(path); 
  };

  const renderAvatar = () => {
    const initial = tpoData.name ? String(tpoData.name).charAt(0).toUpperCase() : '?';
    if (!profilePhotoUrl || profilePhotoUrl === 'N/A' || imgError) return <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ffffff' }}>{initial}</span>;
    return <img src={profilePhotoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} />;
  };

  return (
    <div className="app-layout">
      
      {/* 🚨 PREMIUM UX: GLOBAL COMMAND PALETTE (CTRL+K) */}
      <AnimatePresence>
        {isCmdOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="cmd-palette-overlay" 
            onClick={() => setIsCmdOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: -20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: -20 }}
              transition={{ duration: 0.15 }}
              className="cmd-palette-box" 
              onClick={e => e.stopPropagation()}
            >
              <div className="cmd-input-row">
                <MagnifyingGlass size={24} color="#38bdf8" weight="bold" />
                <input 
                  ref={searchInputRef} 
                  type="text" 
                  className="cmd-input" 
                  placeholder="What do you need?" 
                  value={cmdSearch} 
                  onChange={(e) => setCmdSearch(e.target.value)} 
                />
                <div className="cmd-shortcut">ESC</div>
              </div>
              <div className="cmd-results">
                {filteredRoutes.length > 0 ? filteredRoutes.map((route, i) => (
                  <div key={i} className="cmd-item" onClick={() => handleNav(route.path)}>
                    {route.icon} <span>{route.name}</span>
                  </div>
                )) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No modules found.</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="main-content">
        <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px' }}>
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" alt="IPCS Logo" style={{ height: '35px', objectFit: 'contain' }} />
            <div style={{ width: '1px', height: '25px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }}></div>
            <img src="https://lh3.googleusercontent.com/d/1bHpUfH_578DmfityB9cOgFNYhbBGdG9J" alt="Talenzo Logo" style={{ height: '30px', objectFit: 'contain' }} />
            
            {/* 🚨 PREMIUM UX: Quick Search Trigger for Desktop */}
            <div 
              onClick={() => setIsCmdOpen(true)} 
              className="d-md-flex hover-bg"
              style={{ display: 'none', marginLeft: '20px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', color: '#64748b', fontSize: '0.8rem', cursor: 'text', alignItems: 'center', gap: '8px' }} 
            >
              <MagnifyingGlass size={16} /> Quick Search... 
              <span style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>Ctrl K</span>
            </div>
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            
            {/* 🚨 PREMIUM UX: THEME SWITCHER */}
            <div className="theme-picker" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                onClick={toggleTheme} 
                title="Toggle Light / Dark Mode"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
              >
                {theme === 'dark' ? '🌙' : '☀️'}
              </button>
              <div style={{ width: '1px', height: '14px', background: 'var(--card-border)' }} />
              <span className={`color-dot ${accent === 'cyan' ? 'active' : ''}`} style={{ background: '#38bdf8' }} onClick={() => setAccent('cyan')} />
              <span className={`color-dot ${accent === 'emerald' ? 'active' : ''}`} style={{ background: '#10b981' }} onClick={() => setAccent('emerald')} />
              <span className={`color-dot ${accent === 'purple' ? 'active' : ''}`} style={{ background: '#a855f7' }} onClick={() => setAccent('purple')} />
              <span className={`color-dot ${accent === 'amber' ? 'active' : ''}`} style={{ background: '#f59e0b' }} onClick={() => setAccent('amber')} />
            </div>

            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setIsNotifOpen(!isNotifOpen)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                <Bell size={24} weight="fill" />
                {notifications.length > 0 && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', border: '2px solid var(--bg-dark)' }}></span>}
              </button>

              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{ position: 'absolute', top: '40px', right: '0', background: '#0f1523', border: '1px solid #1e293b', borderRadius: '12px', width: '350px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 9999, overflow: 'hidden' }}
                  >
                    <div style={{ padding: '15px', borderBottom: '1px solid #1e293b', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
                      Activity Notifications
                      <span style={{ fontSize: '0.7rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '3px 8px', borderRadius: '10px' }}>Live Updates</span>
                    </div>
                    <div style={{ padding: '0', maxHeight: '350px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent activity for your domain.</div>
                      ) : (
                        notifications.map((notif, idx) => (
                          <div key={idx} style={{ padding: '15px', display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ background: notif.bg, color: notif.color, width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{notif.icon}</div>
                            <div>
                              <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold', marginBottom: '3px' }}>{notif.title}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{notif.desc}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '5px' }}>{notif.time.split(' ')[0]}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="header-profile" onClick={() => setIsDrawerOpen(true)} style={{ cursor: 'pointer' }}>
              <div className="header-avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-border)', border: '2px solid rgba(255,255,255,0.1)' }}>{renderAvatar()}</div>
            </div>
          </div>
        </header>

        {/* 🚨 PREMIUM UX: FRAMER MOTION WRAPPER FOR PAGE TRANSITIONS */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={location.pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="page-container" 
            style={{ padding: '20px 30px', position: 'relative' }} 
            onClick={() => setIsNotifOpen(false)}
          >
            {location.pathname !== '/dashboard' && (
              <div style={{ marginBottom: '25px' }}>
                <button onClick={() => navigate('/dashboard')} style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s' }}>
                  <CaretLeft weight="bold" size={16} /> Back to Dashboard
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </AnimatePresence>
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
            
            {showTracker && (
               <div className="drawer-item" onClick={() => handleNav('/tracker')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Files size={22} color={isActive('/tracker')} /> <span style={{ color: isActive('/tracker') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Job Tracker</span></div><span style={{ color: '#64748b' }}>›</span></div>
            )}
            
            {showReports && (
               <div className="drawer-item" onClick={() => handleNav('/reports')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ChartBar size={22} color={isActive('/reports')} /> <span style={{ color: isActive('/reports') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Reports</span></div><span style={{ color: '#64748b' }}>›</span></div>
            )}

            <div className="drawer-item" onClick={() => handleNav('/placed')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Trophy size={22} color={isActive('/placed')} /> <span style={{ color: isActive('/placed') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Placed Students</span></div><span style={{ color: '#64748b' }}>›</span></div>
            
            {showStudentApps && (
              <div className="drawer-item" onClick={() => handleNav('/applications')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ListChecks size={22} color={isActive('/applications')} /> <span style={{ color: isActive('/applications') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Student Apps</span></div><span style={{ color: '#64748b' }}>›</span></div>
            )}

            <div className="drawer-item" onClick={() => handleNav('/vacancies')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Briefcase size={22} color={isActive('/vacancies')} /> <span style={{ color: isActive('/vacancies') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Vacancies</span></div><span style={{ color: '#64748b' }}>›</span></div>
            
            {!isTrainer && (
              <div className="drawer-item" onClick={() => handleNav('/placement-drives')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><IdentificationCard size={22} color={isActive('/placement-drives')} /> <span style={{ color: isActive('/placement-drives') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Placement Drives</span></div><span style={{ color: '#64748b' }}>›</span></div>
            )}
            {!isTrainer && (
              <div className="drawer-item" onClick={() => handleNav('/clients')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Handshake size={22} color={isActive('/clients')} /> <span style={{ color: isActive('/clients') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Clients & Partners</span></div><span style={{ color: '#64748b' }}>›</span></div>
            )}

            <div className="drawer-item" onClick={() => handleNav('/events')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><CalendarStar size={22} color={isActive('/events')} /> <span style={{ color: isActive('/events') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Events</span></div><span style={{ color: '#64748b' }}>›</span></div>
            <div className="drawer-item" onClick={() => handleNav('/talentino')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><UserCheck size={22} color={isActive('/talentino')} /> <span style={{ color: isActive('/talentino') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Talentino</span></div><span style={{ color: '#64748b' }}>›</span></div>
            
            {showStudyMaterials && (
               <div className="drawer-item" onClick={() => handleNav('/study-materials')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Book size={22} color={isActive('/study-materials')} /> <span style={{ color: isActive('/study-materials') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Study Materials</span></div><span style={{ color: '#64748b' }}>›</span></div>
            )}

            {showTrainerLogs && (
               <div className="drawer-item" onClick={() => handleNav('/trainer-logs')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Notebook size={22} color={isActive('/trainer-logs')} /> <span style={{ color: isActive('/trainer-logs') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Daily Log Report</span></div><span style={{ color: '#64748b' }}>›</span></div>
            )}
            
            {!userRole.includes('MANAGER') && !isTpo && (
               <div className="drawer-item" onClick={() => handleNav('/exams')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><FileText size={22} color={isActive('/exams')} /> <span style={{ color: isActive('/exams') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Exams Hub</span></div><span style={{ color: '#64748b' }}>›</span></div>
            )}

            {/* 🚨 ASSET MANAGEMENT (MINI-ERP) */}
            {(isSuperAdmin || userRole.includes('MANAGER')) && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ display: 'block', padding: '0 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Asset Management</span>
                
                <div className="drawer-item" onClick={() => handleNav('/assets/dashboard')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ChartBar size={22} color={isActive('/assets/dashboard') === '#38bdf8' ? '#38bdf8' : '#94a3b8'} /> <span style={{ color: isActive('/assets/dashboard') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Dashboard</span></div><span style={{ color: '#64748b' }}>›</span></div>
                
                <div className="drawer-item" onClick={() => handleNav('/assets')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Barcode size={22} color={isActive('/assets') === '#38bdf8' ? '#38bdf8' : '#94a3b8'} /> <span style={{ color: isActive('/assets') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Master Registry</span></div><span style={{ color: '#64748b' }}>›</span></div>
                <div className="drawer-item" onClick={() => handleNav('/assets/add')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Plus size={22} color={isActive('/assets/add') === '#38bdf8' ? '#38bdf8' : '#94a3b8'} /> <span style={{ color: isActive('/assets/add') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Register Asset</span></div><span style={{ color: '#64748b' }}>›</span></div>
                <div className="drawer-item" onClick={() => handleNav('/assets/inventory')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Package size={22} color={isActive('/assets/inventory') === '#38bdf8' ? '#38bdf8' : '#94a3b8'} /> <span style={{ color: isActive('/assets/inventory') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Consumables</span></div><span style={{ color: '#64748b' }}>›</span></div>
                <div className="drawer-item" onClick={() => handleNav('/assets/transfers')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ArrowsLeftRight size={22} color={isActive('/assets/transfers') === '#38bdf8' ? '#38bdf8' : '#94a3b8'} /> <span style={{ color: isActive('/assets/transfers') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Transfers</span></div><span style={{ color: '#64748b' }}>›</span></div>
                <div className="drawer-item" onClick={() => handleNav('/assets/maintenance')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Wrench size={22} color={isActive('/assets/maintenance') === '#38bdf8' ? '#38bdf8' : '#94a3b8'} /> <span style={{ color: isActive('/assets/maintenance') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Maintenance</span></div><span style={{ color: '#64748b' }}>›</span></div>
              </div>
            )}

            {showManageAdmin && (
               <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                 <span style={{ display: 'block', padding: '0 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>System Admin</span>
                 <div className="drawer-item" onClick={() => handleNav('/branches')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><MapPin size={22} color={isActive('/branches')} /> <span style={{ color: isActive('/branches') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Manage Branches</span></div><span style={{ color: '#64748b' }}>›</span></div>
                 <div className="drawer-item" onClick={() => handleNav('/courses')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Bookmarks size={22} color={isActive('/courses')} /> <span style={{ color: isActive('/courses') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Manage Courses</span></div><span style={{ color: '#64748b' }}>›</span></div>
                 <div className="drawer-item" onClick={() => handleNav('/users')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ShieldCheck size={22} color={isActive('/users')} /> <span style={{ color: isActive('/users') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>User Management</span></div><span style={{ color: '#64748b' }}>›</span></div>
                 <div className="drawer-item" onClick={() => handleNav('/security-logs')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ShieldCheck size={22} color={isActive('/security-logs')} /> <span style={{ color: isActive('/security-logs') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Security Logs</span></div><span style={{ color: '#64748b' }}>›</span></div>
               </div>
            )}

            <div className="drawer-item" style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }} onClick={() => handleNav('/settings')}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Gear size={22} color={isActive('/settings')} /> <span style={{ color: isActive('/settings') === '#38bdf8' ? '#fff' : '#cbd5e1' }}>Settings</span></div><span style={{ color: '#64748b' }}>›</span></div>
          </div>
          
          <div className="drawer-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '20px', flexShrink: 0 }}>
            <button className="btn-logout-drawer" onClick={handleLogout} style={{ width: '100%', padding: '10px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Log Out</button>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '12px', textAlign: 'center' }}>Copyright © 2026 IPCS Global</div>
          </div>
        </div>
      </div>

      {/* Inline styles for Command Palette UI overrides */}
      <style>{`
        @media (min-width: 768px) {
          .d-md-flex { display: flex !important; }
        }
        .hover-bg:hover { background: rgba(255,255,255,0.05) !important; cursor: pointer; }
      `}</style>
    </div>
  );
}