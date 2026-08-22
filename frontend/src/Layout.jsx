import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  SquaresFour, Users, Briefcase, CalendarBlank, 
  WarningCircle, ChartBar, Handshake, Gear, SignOut, List, X,
  Moon, Sun, BookOpen, NotePencil, GraduationCap
} from '@phosphor-icons/react';

export default function Layout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [theme, setTheme] = useState(document.body.getAttribute('data-theme') || 'dark');
  
  // 🚨 EXTRACT ROLE FROM LOCAL STORAGE (Defaults to TPO)
  const role = tpoData?.role || 'TPO'; 

  useEffect(() => {
    if (!tpoData) navigate('/login');
  }, [tpoData, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('tpoData');
    navigate('/login');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    setTheme(newTheme);
  };

  const isActive = (path) => location.pathname === path;

  // ==========================================
  // 🚨 DYNAMIC SIDEBAR ROUTING BASED ON ROLE
  // ==========================================
  const sidebarLinks = [];

  if (role === 'RTH') {
    sidebarLinks.push(
      { name: 'Dashboard', path: '/', icon: <SquaresFour size={22} weight={isActive('/') ? "fill" : "regular"} /> },
      { name: 'Course Students', path: '/students', icon: <GraduationCap size={22} weight={isActive('/students') ? "fill" : "regular"} /> },
      { name: 'Study Materials', path: '/materials', icon: <BookOpen size={22} weight={isActive('/materials') ? "fill" : "regular"} /> },
      { name: 'Exam Access', path: '/exams', icon: <NotePencil size={22} weight={isActive('/exams') ? "fill" : "regular"} /> },
      { name: 'Settings', path: '/settings', icon: <Gear size={22} weight={isActive('/settings') ? "fill" : "regular"} /> }
    );
  } else if (role === 'SUPER ADMIN' || role === 'ADMIN') {
    sidebarLinks.push(
      { name: 'Master Dashboard', path: '/', icon: <SquaresFour size={22} weight={isActive('/') ? "fill" : "regular"} /> },
      { name: 'All Students', path: '/students', icon: <Users size={22} weight={isActive('/students') ? "fill" : "regular"} /> },
      { name: 'All Applications', path: '/applications', icon: <Briefcase size={22} weight={isActive('/applications') ? "fill" : "regular"} /> },
      { name: 'Global Vacancies', path: '/vacancies', icon: <ChartBar size={22} weight={isActive('/vacancies') ? "fill" : "regular"} /> },
      { name: 'Global Reports', path: '/reports', icon: <ChartBar size={22} weight={isActive('/reports') ? "fill" : "regular"} /> },
      { name: 'Settings', path: '/settings', icon: <Gear size={22} weight={isActive('/settings') ? "fill" : "regular"} /> }
    );
  } else {
    // Default TPO Links
    sidebarLinks.push(
      { name: 'Dashboard', path: '/', icon: <SquaresFour size={22} weight={isActive('/') ? "fill" : "regular"} /> },
      { name: 'Directory', path: '/students', icon: <Users size={22} weight={isActive('/students') ? "fill" : "regular"} /> },
      { name: 'Applications', path: '/applications', icon: <Briefcase size={22} weight={isActive('/applications') ? "fill" : "regular"} /> },
      { name: 'Job Vacancies', path: '/vacancies', icon: <ChartBar size={22} weight={isActive('/vacancies') ? "fill" : "regular"} /> },
      { name: 'Calendar', path: '/events', icon: <CalendarBlank size={22} weight={isActive('/events') ? "fill" : "regular"} /> },
      { name: 'Issues', path: '/issues', icon: <WarningCircle size={22} weight={isActive('/issues') ? "fill" : "regular"} /> },
      { name: 'Reports', path: '/reports', icon: <ChartBar size={22} weight={isActive('/reports') ? "fill" : "regular"} /> },
      { name: 'Talentino', path: '/talentino', icon: <Users size={22} weight={isActive('/talentino') ? "fill" : "regular"} /> },
      { name: 'Clients (MOU)', path: '/clients', icon: <Handshake size={22} weight={isActive('/clients') ? "fill" : "regular"} /> },
      { name: 'Settings', path: '/settings', icon: <Gear size={22} weight={isActive('/settings') ? "fill" : "regular"} /> }
    );
  }

  return (
    <div className="layout-wrapper">
      <div className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
              I
            </div>
            <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#fff', letterSpacing: '1px' }}>IPCS <span style={{ color: '#38bdf8', fontWeight: 300 }}>GLOBAL</span></h2>
          </div>
          <button className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} color="#fff" />
          </button>
        </div>

        <div className="sidebar-nav">
          {/* Label indicating which portal is active */}
          <div style={{ padding: '0 20px', marginBottom: '10px', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
            {role} PORTAL
          </div>
          
          {sidebarLinks.map((link) => (
            <Link key={link.name} to={link.path} className={`nav-item ${isActive(link.path) ? 'active' : ''}`} onClick={() => setIsMobileMenuOpen(false)}>
              {link.icon} <span>{link.name}</span>
            </Link>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-profile-mini">
            <div className="avatar">{tpoData?.name ? tpoData.name.charAt(0).toUpperCase() : 'U'}</div>
            <div className="user-info">
              <span className="user-name">{tpoData?.name}</span>
              <span className="user-role" style={{ color: '#38bdf8', fontWeight: 'bold' }}>{role}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <SignOut size={20} />
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="top-navbar">
          <button className="mobile-toggle-btn" onClick={() => setIsMobileMenuOpen(true)}>
            <List size={26} color="var(--text-main)" />
          </button>
          
          <div className="top-nav-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '15px' }}>
             <button onClick={toggleTheme} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {theme === 'dark' ? <Sun size={22} weight="fill" /> : <Moon size={22} weight="fill" />}
             </button>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-dark)', padding: '5px 15px', borderRadius: '20px', border: '1px solid var(--card-border)' }}>
               <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{tpoData?.name}</span>
             </div>
          </div>
        </div>
        
        <div className="content-scroll-area">
          {children}
        </div>
      </div>
    </div>
  );
}