import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell, X, SquaresFour, Trophy, ListChecks, 
  UserCheck, Gear, Users, Briefcase, Files, CalendarStar, ChartBar, Handshake,
  Book, FileText, Brain, PencilSimple, Bookmarks, ShieldCheck, IdentificationCard,
  MagnifyingGlass, ChatCircleDots, CaretDown, List
} from '@phosphor-icons/react';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [tpoData] = useState(() => {
    try {
      const data = localStorage.getItem('tpoData');
      return data ? JSON.parse(data) : null;
    } catch (error) { return null; }
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!tpoData) navigate('/');
    document.body.setAttribute('data-theme', 'dark');
  }, [tpoData, navigate]);

  if (!tpoData) return null;

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };
  
  const profilePhotoUrl = getDriveImage(tpoData.photo);
  const isActive = (path) => location.pathname.startsWith(path);

  const handleLogout = () => {
    localStorage.removeItem('tpoData');
    navigate('/');
  };

  const NavItem = ({ icon: Icon, label, path }) => {
    const active = isActive(path) && path !== '/' || (path === '/dashboard' && location.pathname === '/dashboard');
    return (
      <div 
        onClick={() => { navigate(path); setIsSidebarOpen(false); }}
        className={`nav-item ${active ? 'active' : ''}`}
      >
        <Icon size={20} weight={active ? "fill" : "regular"} />
        <span>{label}</span>
      </div>
    );
  };

  return (
    <div className="enterprise-layout">
      {/* ========================================== */}
      {/* LEFT SIDEBAR */}
      {/* ========================================== */}
      <aside className={`enterprise-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img 
            src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" 
            alt="IPCS Logo" 
            style={{ height: '28px', objectFit: 'contain' }} 
            onError={(e) => { e.currentTarget.src = 'https://ipcsglobal.com/wp-content/uploads/2023/12/IPCS-Global-Logo-1.png'; }}
          />
          <X className="mobile-close" size={24} onClick={() => setIsSidebarOpen(false)} />
        </div>

        <div className="sidebar-scroll-area">
          <NavItem icon={SquaresFour} label="Dashboard" path="/dashboard" />

          <div className="sidebar-category">PLACEMENT & CR</div>
          <NavItem icon={Users} label="Students" path="/students" />
          <NavItem icon={IdentificationCard} label="Placement Drives" path="/placement-drives" />
          <NavItem icon={ListChecks} label="Applications" path="/applications" />
          <NavItem icon={Briefcase} label="Vacancies" path="/vacancies" />
          <NavItem icon={Handshake} label="Clients & Partners" path="/clients" />
          <NavItem icon={Trophy} label="Placed Students" path="/placed" />
          {(tpoData.role || '').toUpperCase() === 'TPO' && <NavItem icon={Files} label="Job Tracker" path="/tracker" />}

          {(tpoData.accessType === 'superadmin' || (tpoData.role || '').toUpperCase().includes('RTH')) && (
            <>
              <div className="sidebar-category">EXAMS & LMS</div>
              <NavItem icon={Book} label="Study Materials" path="/study-materials" />
              <NavItem icon={FileText} label="Exams Hub" path="/exams" />
              <NavItem icon={UserCheck} label="Talentino Tracking" path="/talentino" />
            </>
          )}

          <div className="sidebar-category">EVENTS & SCHEDULE</div>
          <NavItem icon={CalendarStar} label="Global Calendar" path="/events" />

          <div className="sidebar-category">ADMINISTRATION</div>
          {(tpoData.role || '').toUpperCase() === 'TPO' && <NavItem icon={ChartBar} label="Reports" path="/reports" />}
          {tpoData.accessType === 'superadmin' && (
            <>
              <NavItem icon={Bookmarks} label="Manage Courses" path="/courses" />
              <NavItem icon={ShieldCheck} label="User Management" path="/users" />
            </>
          )}
          <NavItem icon={Gear} label="Settings" path="/settings" />
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>Log Out</button>
        </div>
      </aside>

      {/* ========================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================== */}
      <div className="enterprise-main">
        
        {/* TOP HEADER */}
        <header className="enterprise-top-header">
          <div className="header-left">
            <List size={26} className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Dashboard</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Welcome back, {tpoData.name.split(' ')[0]} 👋</span>
            </div>
          </div>

          <div className="header-search">
            <MagnifyingGlass size={18} color="var(--text-muted)" />
            <input type="text" placeholder="Search students, drives, companies..." />
            <div className="kbd-shortcut">⌘ K</div>
          </div>

          <div className="header-right">
            <button className="icon-btn"><ChatCircleDots size={22} /><span className="badge">3</span></button>
            <button className="icon-btn"><Bell size={22} /><span className="badge">8</span></button>
            
            <div className="header-profile">
              {profilePhotoUrl ? <img src={profilePhotoUrl} alt="Profile" /> : <div className="avatar-fallback">{tpoData.name.charAt(0)}</div>}
              <div className="profile-text">
                <div className="name">{tpoData.name}</div>
                <div className="role">{tpoData.role}</div>
              </div>
              <CaretDown size={14} color="var(--text-muted)" />
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="enterprise-content">
          {children}
        </div>
      </div>

      {/* OVERLAY FOR MOBILE */}
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* GLOBAL CSS FOR NEW ENTERPRISE LAYOUT */}
      <style>{`
        body { margin: 0; background: #0b1120; font-family: 'Inter', sans-serif; color: #f8fafc; }
        
        .enterprise-layout { display: flex; height: 100vh; overflow: hidden; }
        
        /* SIDEBAR */
        .enterprise-sidebar { width: 260px; background: #111827; border-right: 1px solid #1e293b; display: flex; flex-direction: column; flex-shrink: 0; z-index: 1000; transition: transform 0.3s ease; }
        .sidebar-header { padding: 20px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }
        .mobile-close { display: none; cursor: pointer; color: #94a3b8; }
        .sidebar-scroll-area { flex: 1; overflow-y: auto; padding: 15px 10px; }
        .sidebar-scroll-area::-webkit-scrollbar { width: 4px; }
        .sidebar-scroll-area::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        
        .sidebar-category { font-size: 0.65rem; font-weight: bold; color: #64748b; margin: 20px 0 10px 15px; letter-spacing: 1px; }
        .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 15px; margin-bottom: 4px; border-radius: 8px; color: #94a3b8; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: #f8fafc; }
        .nav-item.active { background: #3b82f6; color: #ffffff; font-weight: 600; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
        
        .sidebar-footer { padding: 15px; border-top: 1px solid #1e293b; }
        .logout-btn { width: 100%; padding: 10px; border-radius: 8px; border: none; background: rgba(239, 68, 68, 0.1); color: #ef4444; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .logout-btn:hover { background: #ef4444; color: #fff; }

        /* MAIN AREA & HEADER */
        .enterprise-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #0b1120; }
        .enterprise-top-header { height: 70px; background: #0b1120; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; padding: 0 25px; flex-shrink: 0; }
        .header-left { display: flex; align-items: center; gap: 15px; }
        .mobile-menu-btn { display: none; cursor: pointer; color: #94a3b8; }
        
        .header-search { display: flex; align-items: center; background: #111827; border: 1px solid #1e293b; padding: 0 15px; border-radius: 20px; width: 400px; height: 40px; }
        .header-search input { background: transparent; border: none; outline: none; color: #fff; width: 100%; margin-left: 10px; font-size: 0.9rem; }
        .kbd-shortcut { background: #1e293b; color: #94a3b8; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }
        
        .header-right { display: flex; align-items: center; gap: 20px; }
        .icon-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; position: relative; padding: 5px; }
        .icon-btn:hover { color: #fff; }
        .badge { position: absolute; top: 0; right: 0; background: #ef4444; color: #fff; font-size: 0.6rem; font-weight: bold; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid #0b1120; }
        
        .header-profile { display: flex; align-items: center; gap: 10px; cursor: pointer; border-left: 1px solid #1e293b; padding-left: 20px; }
        .header-profile img, .avatar-fallback { width: 35px; height: 35px; border-radius: 50%; object-fit: cover; }
        .avatar-fallback { background: #3b82f6; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #fff; }
        .profile-text { display: flex; flex-direction: column; }
        .profile-text .name { font-size: 0.85rem; font-weight: bold; color: #fff; }
        .profile-text .role { font-size: 0.7rem; color: #94a3b8; }

        .enterprise-content { flex: 1; overflow-y: auto; padding: 25px; }

        /* RESPONSIVE RESPONSIVE RESPONSIVE */
        @media (max-width: 1024px) {
          .header-search { width: 250px; }
        }
        @media (max-width: 768px) {
          .enterprise-sidebar { position: fixed; height: 100%; transform: translateX(-100%); }
          .enterprise-sidebar.open { transform: translateX(0); }
          .sidebar-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 999; }
          .mobile-menu-btn, .mobile-close { display: block; }
          .header-search { display: none; }
          .profile-text { display: none; }
          .enterprise-content { padding: 15px; }
        }
      `}</style>
    </div>
  );
}