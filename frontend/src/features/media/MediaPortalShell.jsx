import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CaretRight, ChartBar, ClockCounterClockwise, FolderOpen, ImageSquare,
  List, PaintBrush, ShareNetwork, Shapes, SignOut, SlidersHorizontal, Sparkle,
  UserCircle, X
} from '@phosphor-icons/react';
import { isPortalAdminAccount } from '../../utils/roleAccess';
import './MediaStudio.css';

const navigation = [
  { label: 'Studio overview', to: '/media/dashboard', icon: ChartBar, end: true, group: 'WORKSPACE' },
  { label: 'Preview gallery', to: '/media/preview', icon: ImageSquare, group: 'WORKSPACE' },
  { label: 'File vault', to: '/media/files', icon: FolderOpen, group: 'LIBRARY' },
  { label: 'Task categories', to: '/media/categories', icon: Shapes, group: 'LIBRARY' },
  { label: 'Social publishing', to: '/media/social', icon: ShareNetwork, group: 'PUBLISHING' },
  { label: 'Activity history', to: '/media/logs', icon: ClockCounterClockwise, group: 'PUBLISHING' },
  { label: 'Studio settings', to: '/media/settings', icon: SlidersHorizontal, group: 'STUDIO' }
];

const readAccount = () => {
  try { return JSON.parse(localStorage.getItem('tpoData') || '{}') || {}; }
  catch { return {}; }
};

const imageUrl = value => {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : value;
};

export default function MediaPortalShell({ children, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState(user || readAccount());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => { if (user) setAccount(user); }, [user]);
  useEffect(() => {
    const refreshAccount = () => setAccount(readAccount());
    window.addEventListener('portal-account-updated', refreshAccount);
    return () => window.removeEventListener('portal-account-updated', refreshAccount);
  }, []);
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  const name = account.name || account.email || 'Studio team member';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const photo = imageUrl(account.photo || account.profilePhoto);
  const isAdmin = isPortalAdminAccount(account);

  const signOut = () => {
    localStorage.removeItem('tpoData');
    navigate('/login', { replace: true });
  };

  return <div className="media-portal">
    {mobileNavOpen && <button className="media-portal-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
    <aside className={`media-portal-sidebar${mobileNavOpen ? ' is-open' : ''}`} aria-label="Media and Design Studio navigation">
      <div className="media-portal-brand">
        <span className="media-brand-mark"><PaintBrush size={22} weight="fill" /></span>
        <span><b>IPCS STUDIO</b><small>MEDIA · DESIGN · PUBLISH</small></span>
        <button className="media-close-nav" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
      </div>

      <div className="media-account-card">
        <span className="media-avatar">{photo ? <img src={photo} alt="" /> : initials || <UserCircle size={20} />}</span>
        <span className="media-account-copy"><b>{name}</b><small>{account.role || 'Media team'}</small></span>
        <span className="media-online-dot" title="Signed in" />
      </div>

      <nav className="media-portal-nav">
        {['WORKSPACE', 'LIBRARY', 'PUBLISHING', 'STUDIO'].map(group => {
          const links = navigation.filter(item => item.group === group);
          return <section className="media-nav-group" key={group}>
            <span className="media-nav-heading">{group}</span>
            {links.map(({ label, to, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `media-nav-link${isActive ? ' active' : ''}`}>
              <Icon size={19} weight="duotone" /><span>{label}</span><CaretRight className="media-nav-chevron" size={14} />
            </NavLink>)}
          </section>;
        })}
      </nav>

      <div className="media-sidebar-footer">
        <div className="media-team-note"><Sparkle size={17} weight="fill" /><span><b>Creative workspace</b><small>Ideas to finished work</small></span></div>
        <button type="button" onClick={() => navigate(isAdmin ? '/dashboard' : '/career-hub')}><ArrowLeft size={17} /> Main portal</button>
        <button type="button" onClick={signOut}><SignOut size={17} /> Sign out</button>
      </div>
    </aside>

    <div className="media-portal-main">
      <header className="media-portal-topbar">
        <button className="media-menu-button" type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><List size={20} /></button>
        <div className="media-breadcrumb"><span>IPCS WORKSPACES</span><CaretRight size={14} /><b>Media &amp; Design Studio</b></div>
        <div className="media-top-account"><span className="media-status-pill"><i /> Studio active</span><span className="media-avatar small">{photo ? <img src={photo} alt="" /> : initials || <UserCircle size={17} />}</span></div>
      </header>
      <main className="media-portal-content">{children}</main>
    </div>
  </div>;
}
