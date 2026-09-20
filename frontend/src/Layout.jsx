import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  Bell, X, SquaresFour, Trophy, ListChecks, ShieldCheck,
  UserCheck, Gear, Users, Briefcase, Files, CalendarStar, ChartBar, Handshake,
  Book, FileText, Bookmarks, IdentificationCard, CaretLeft, MapPin,
  WarningCircle, Notebook, Barcode, Package, ArrowsLeftRight, Wrench, Plus,
  Headset, SignOut, PaintBrush,
  Kanban, ImageSquare, ShareNetwork, CheckCircle, ClockCounterClockwise, SlidersHorizontal
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
    document.body.setAttribute('data-theme', 'dark');
    
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
          let color = "#8b5cf6"; let bg = "rgba(56, 189, 248, 0.1)";

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

  if (!tpoData) return <div style={{ minHeight: '100vh', background: '#020617' }}>{children}</div>;

  const userRole = (tpoData.role || '').toUpperCase();
  const sheetAccess = (tpoData.accessType || '').toLowerCase();
  
  // 🚨 STRICT ISOLATION: Locks out anyone with "Asset" or "Design" in their role or access type
  const isAssetManager = userRole.includes('ASSET') || sheetAccess.includes('asset');
  const isDesigner = userRole.includes('DESIGN') || userRole.includes('MEDIA') || userRole.includes('CREATIVE');
  
  // Force hiding of all Student/Placement tabs if they are strictly Asset or Design
  const showPlacementAndAcademic = !isAssetManager && !isDesigner;

  const isSuperAdmin = tpoData.accessType === 'superadmin' || userRole.includes('GENERAL MANAGER') || userRole.includes('ZONAL PLACEMENT HEAD') || userRole === 'TECHNICAL HEAD';
  const isTpo = userRole.includes('TPO') || userRole.includes('PLACEMENT OFFICER');
  const isTrainer = userRole.includes('TRAINER');
  const isRth = userRole.includes('RTH') || userRole.includes('REGIONAL TECHNICAL HEAD');
  const isTL = userRole.includes('TECHNICAL LEAD') || userRole.includes('TTH') || isRth || (userRole.includes('MANAGER') && showPlacementAndAcademic) || isSuperAdmin;

  // Role Checks
  const showTracker = isTpo && !isSuperAdmin && showPlacementAndAcademic; 
  const showReports = (isSuperAdmin || isTpo) && showPlacementAndAcademic; 
  const showManageAdmin = isSuperAdmin;
  const showStudyMaterials = (isSuperAdmin || isRth || userRole.includes('TTH') || userRole.includes('TECHNICAL LEAD') || isTrainer) && showPlacementAndAcademic; 
  const showTrainerLogs = (isTrainer || isTL) && showPlacementAndAcademic;
  const showStudentApps = isTpo && !isSuperAdmin && showPlacementAndAcademic;
  const showIssues = (isTpo || isSuperAdmin || (userRole.includes('MANAGER') && showPlacementAndAcademic) || userRole.includes('ZONAL')) && showPlacementAndAcademic;

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };
  
  const profilePhotoUrl = getDriveImage(tpoData.photo);
  const isActive = (path) => location.pathname.startsWith(path) ? '#8b5cf6' : '#94a3b8';

  const handleLogout = () => { localStorage.removeItem('tpoData'); navigate('/'); };
  const handleNav = (path) => { setIsDrawerOpen(false); navigate(path); };

  const renderAvatar = () => {
    const initial = tpoData.name ? String(tpoData.name).charAt(0).toUpperCase() : '?';
    if (!profilePhotoUrl || profilePhotoUrl === 'N/A' || imgError) return <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ffffff' }}>{initial}</span>;
    return <img src={profilePhotoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} />;
  };

  const defaultBackPath = isAssetManager ? '/assets/dashboard' : (isDesigner ? '/media/dashboard' : '/dashboard');

  return (
    <div className="app-layout">
      <main className="main-content">
        <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px' }}>
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" alt="IPCS Logo" style={{ height: '35px', objectFit: 'contain' }} />
            <div style={{ width: '1px', height: '25px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }}></div>
            <img src="https://lh3.googleusercontent.com/d/1bHpUfH_578DmfityB9cOgFNYhbBGdG9J" alt="Talenzo Logo" style={{ height: '30px', objectFit: 'contain' }} />
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setIsNotifOpen(!isNotifOpen)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                <Bell size={24} weight="fill" />
                {notifications.length > 0 && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', border: '2px solid var(--bg-dark)' }}></span>}
              </button>

              {isNotifOpen && (
                <div style={{ position: 'absolute', top: '40px', right: '0', background: '#0f1523', border: '1px solid #1e293b', borderRadius: '12px', width: '350px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 9999, overflow: 'hidden' }}>
                  <div style={{ padding: '15px', borderBottom: '1px solid #1e293b', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
                    Activity Notifications
                    <span style={{ fontSize: '0.7rem', background: 'rgba(56, 189, 248, 0.1)', color: '#8b5cf6', padding: '3px 8px', borderRadius: '10px' }}>Live Updates</span>
                  </div>
                  <div style={{ padding: '0', maxHeight: '350px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent activity.</div>
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
                </div>
              )}
            </div>

            <div className="header-profile" onClick={() => setIsDrawerOpen(true)} style={{ cursor: 'pointer' }}>
              <div className="header-avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card-border)', border: '2px solid rgba(255,255,255,0.1)' }}>{renderAvatar()}</div>
            </div>
          </div>
        </header>

        <div className="page-container" style={{ padding: '20px 30px', position: 'relative' }} onClick={() => setIsNotifOpen(false)}>
          {location.pathname !== '/dashboard' && location.pathname !== '/assets/dashboard' && location.pathname !== '/media/dashboard' && (
            <div style={{ marginBottom: '25px' }}>
              <button onClick={() => navigate(defaultBackPath)} style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s' }}>
                <CaretLeft weight="bold" size={16} /> Back to Dashboard
              </button>
            </div>
          )}
          {children}
        </div>
      </main>

      {/* 🚨 PREMIUM FLOATING MENU SLIDER */}
      <div className={`premium-drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={(e) => { if(e.target.classList.contains('premium-drawer-overlay')) setIsDrawerOpen(false); }}>
        <div className="premium-drawer-card">
          
          <div className="pd-header">
            <div className="pd-close-btn" onClick={() => setIsDrawerOpen(false)}>
              <X size={18} weight="bold" />
            </div>
            <div className="pd-profile-group">
              <div className="pd-avatar-ring">
                <div className="pd-avatar-inner">{renderAvatar()}</div>
              </div>
              <h3 className="pd-name">{tpoData.name}</h3>
              <p className="pd-role">{tpoData.role || 'User'}</p>
            </div>
          </div>

          <div className="pd-nav-list">
            
            {showPlacementAndAcademic && (
              <>
                <span className="pd-divider-label">Main Menu</span>
                <div className={`pd-nav-item ${isActive('/dashboard') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/dashboard')}><SquaresFour size={22} weight={isActive('/dashboard') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Dashboard</span></div>
                <div className={`pd-nav-item ${isActive('/students') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/students')}><Users size={22} weight={isActive('/students') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Students Directory</span></div>
                {showIssues && <div className={`pd-nav-item ${isActive('/issues') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/issues')}><Headset size={22} weight={isActive('/issues') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Issue Resolution</span></div>}
                {showTracker && <div className={`pd-nav-item ${isActive('/tracker') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/tracker')}><Files size={22} weight={isActive('/tracker') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Job Tracker</span></div>}
                {showReports && <div className={`pd-nav-item ${isActive('/reports') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/reports')}><ChartBar size={22} weight={isActive('/reports') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Reports</span></div>}
                <div className={`pd-nav-item ${isActive('/placed') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/placed')}><Trophy size={22} weight={isActive('/placed') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Placed Students</span></div>
                {showStudentApps && <div className={`pd-nav-item ${isActive('/applications') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/applications')}><ListChecks size={22} weight={isActive('/applications') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Student Apps</span></div>}
                <div className={`pd-nav-item ${isActive('/vacancies') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/vacancies')}><Briefcase size={22} weight={isActive('/vacancies') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Vacancies</span></div>
                {!isTrainer && <div className={`pd-nav-item ${isActive('/placement-drives') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/placement-drives')}><IdentificationCard size={22} weight={isActive('/placement-drives') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Placement Drives</span></div>}
                {!isTrainer && <div className={`pd-nav-item ${isActive('/clients') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/clients')}><Handshake size={22} weight={isActive('/clients') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Clients & Partners</span></div>}

                <span className="pd-divider-label" style={{ marginTop: '15px' }}>Training & Academics</span>
                <div className={`pd-nav-item ${isActive('/academic/training') === '#10b981' ? 'active-acad' : ''}`} onClick={() => handleNav('/academic/training')}>
                  <GraduationCap size={22} weight={isActive('/academic/training') === '#10b981' ? 'fill' : 'regular'} /> <span>Student Training</span>
                </div>
                <div className={`pd-nav-item ${isActive('/academic/batches') === '#10b981' ? 'active-acad' : ''}`} onClick={() => handleNav('/academic/batches')}>
                  <UsersFour size={22} weight={isActive('/academic/batches') === '#10b981' ? 'fill' : 'regular'} /> <span>Batch Management</span>
                </div>
                <div className={`pd-nav-item ${isActive('/academic/sessions') === '#10b981' ? 'active-acad' : ''}`} onClick={() => handleNav('/academic/sessions')}>
                  <ChalkboardTeacher size={22} weight={isActive('/academic/sessions') === '#10b981' ? 'fill' : 'regular'} /> <span>Live Sessions</span>
                </div>
                <div className={`pd-nav-item ${isActive('/academic/attendance') === '#10b981' ? 'active-acad' : ''}`} onClick={() => handleNav('/academic/attendance')}>
                  <CalendarCheck size={22} weight={isActive('/academic/attendance') === '#10b981' ? 'fill' : 'regular'} /> <span>Attendance Register</span>
                </div>
                <div className={`pd-nav-item ${isActive('/academic/diary') === '#10b981' ? 'active-acad' : ''}`} onClick={() => handleNav('/academic/diary')}>
                  <Notebook size={22} weight={isActive('/academic/diary') === '#10b981' ? 'fill' : 'regular'} /> <span>Student Diary</span>
                </div>
              </>
            )}

            {/* 🚨 MEDIA & DESIGN MANAGEMENT */}
            {(isSuperAdmin || isDesigner) && (
              <>
                <span className="pd-divider-label" style={isSuperAdmin ? { marginTop: '15px' } : {}}>Media & Design Studio</span>
                <div className={`pd-nav-item ${isActive('/media/dashboard') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/media/dashboard')}>
                  <Kanban size={22} weight={isActive('/media/dashboard') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Active Queues</span>
                </div>
                <div className={`pd-nav-item ${isActive('/media/preview') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/media/preview')}>
                  <ImageSquare size={22} weight={isActive('/media/preview') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Preview Gallery</span>
                </div>
                <div className={`pd-nav-item ${isActive('/media/files') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/media/files')}>
                  <Files size={22} weight={isActive('/media/files') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>File Vault</span>
                </div>
                <div className={`pd-nav-item ${isActive('/media/social') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/media/social')}>
                  <ShareNetwork size={22} weight={isActive('/media/social') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Social Media</span>
                </div>
                <div className={`pd-nav-item ${isActive('/media/categories') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/media/categories')}>
                  <CheckCircle size={22} weight={isActive('/media/categories') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Categories</span>
                </div>
                <div className={`pd-nav-item ${isActive('/media/logs') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/media/logs')}>
                  <ClockCounterClockwise size={22} weight={isActive('/media/logs') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Activity Logs</span>
                </div>
                <div className={`pd-nav-item ${isActive('/media/settings') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/media/settings')}>
                  <SlidersHorizontal size={22} weight={isActive('/media/settings') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Studio Settings</span>
                </div>
              </>
            )}

            {/* 🚨 ASSET MANAGEMENT */}
            {(isSuperAdmin || userRole.includes('MANAGER') || isAssetManager) && !isDesigner && (
              <>
                <span className="pd-divider-label" style={showPlacementAndAcademic ? { marginTop: '15px' } : {}}>Asset Management</span>
                <div className={`pd-nav-item ${isActive('/assets/dashboard') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/assets/dashboard')}>
                  <ChartBar size={22} weight={isActive('/assets/dashboard') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Asset Dashboard</span>
                </div>
                <div className={`pd-nav-item ${isActive('/assets') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/assets')}>
                  <Barcode size={22} weight={isActive('/assets') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Master Registry</span>
                </div>
                <div className={`pd-nav-item ${isActive('/assets/add') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/assets/add')}>
                  <Plus size={22} weight={isActive('/assets/add') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Register Asset</span>
                </div>
                <div className={`pd-nav-item ${isActive('/assets/inventory') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/assets/inventory')}>
                  <Package size={22} weight={isActive('/assets/inventory') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Consumables</span>
                </div>
                <div className={`pd-nav-item ${isActive('/assets/transfers') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/assets/transfers')}>
                  <ArrowsLeftRight size={22} weight={isActive('/assets/transfers') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Transfers</span>
                </div>
                <div className={`pd-nav-item ${isActive('/assets/maintenance') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/assets/maintenance')}>
                  <Wrench size={22} weight={isActive('/assets/maintenance') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Maintenance</span>
                </div>
              </>
            )}

            {showManageAdmin && (
              <>
                <span className="pd-divider-label" style={{ marginTop: '15px' }}>System Admin</span>
                <div className={`pd-nav-item ${isActive('/branches') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/branches')}>
                  <MapPin size={22} weight={isActive('/branches') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Manage Branches</span>
                </div>
                <div className={`pd-nav-item ${isActive('/courses') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/courses')}>
                  <Bookmarks size={22} weight={isActive('/courses') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Manage Courses</span>
                </div>
                <div className={`pd-nav-item ${isActive('/users') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/users')}>
                  <ShieldCheck size={22} weight={isActive('/users') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>User Management</span>
                </div>
                <div className={`pd-nav-item ${isActive('/security-logs') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/security-logs')}>
                  <ShieldCheck size={22} weight={isActive('/security-logs') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Security Logs</span>
                </div>
              </>
            )}

            <span className="pd-divider-label" style={{ marginTop: '15px' }}>Preferences</span>
            <div className={`pd-nav-item ${isActive('/settings') === '#8b5cf6' ? 'active' : ''}`} onClick={() => handleNav('/settings')}>
              <Gear size={22} weight={isActive('/settings') === '#8b5cf6' ? 'fill' : 'regular'} /> <span>Settings</span>
            </div>
          </div>

          <div className="pd-footer">
            <button className="pd-logout-btn hover-lift" onClick={handleLogout}>
              <SignOut size={20} weight="bold" /> Logout
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .premium-drawer-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(2, 6, 23, 0.6); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
        .premium-drawer-overlay.open { opacity: 1; pointer-events: all; }
        .premium-drawer-card { position: absolute; top: 20px; right: -350px; bottom: 20px; width: 320px; background: #12121f; border-radius: 28px; display: flex; flex-direction: column; box-shadow: -15px 15px 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05); transition: right 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); overflow: hidden; }
        .premium-drawer-overlay.open .premium-drawer-card { right: 20px; }
        @media (max-width: 480px) { .premium-drawer-card { top: 0; bottom: 0; right: -100%; width: 85%; border-radius: 20px 0 0 20px; } .premium-drawer-overlay.open .premium-drawer-card { right: 0; } }
        .pd-header { padding: 30px 20px 20px 20px; display: flex; flex-direction: column; align-items: center; position: relative; }
        .pd-close-btn { position: absolute; top: 20px; right: 20px; width: 32px; height: 32px; background: rgba(255,255,255,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #94a3b8; cursor: pointer; transition: 0.2s; }
        .pd-close-btn:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444; transform: rotate(90deg); }
        .pd-profile-group { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .pd-avatar-ring { width: 76px; height: 76px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #8b5cf6); padding: 3px; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3); }
        .pd-avatar-inner { width: 100%; height: 100%; border-radius: 50%; background: #0f1523; overflow: hidden; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 1.5rem; }
        .pd-avatar-inner img { width: 100%; height: 100%; object-fit: cover; }
        .pd-name { margin: 0 0 4px 0; color: #f8fafc; font-size: 1.2rem; font-weight: 700; letter-spacing: -0.5px; }
        .pd-role { margin: 0; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .pd-divider-label { display: block; color: #475569; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; margin: 10px 0 8px 15px; }
        .pd-nav-list { flex: 1; overflow-y: auto; padding: 0 15px; display: flex; flex-direction: column; gap: 6px; }
        .pd-nav-list::-webkit-scrollbar { width: 4px; }
        .pd-nav-list::-webkit-scrollbar-track { background: transparent; }
        .pd-nav-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .pd-nav-item { display: flex; align-items: center; gap: 15px; padding: 12px 18px; border-radius: 16px; color: #94a3b8; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .pd-nav-item:hover { background: rgba(255,255,255,0.03); color: #e2e8f0; transform: translateX(4px); }
        .pd-nav-item.active { background: linear-gradient(135deg, #6366f1, #a855f7); color: #ffffff; box-shadow: 0 8px 20px -6px rgba(99, 102, 241, 0.6); }
        .pd-footer { padding: 20px; background: rgba(0,0,0,0.1); }
        .pd-logout-btn { width: 100%; background: #fff; color: #0f172a; border: none; padding: 14px; border-radius: 14px; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: 0.2s ease; }
        .pd-logout-btn:hover { background: #ef4444; color: #fff; box-shadow: 0 8px 20px -6px rgba(239, 68, 68, 0.5); }
      `}</style>
    </div>
  );
}