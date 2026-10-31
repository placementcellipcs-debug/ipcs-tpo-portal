import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Pulse as Activity, ArrowLeft, ArrowsLeftRight, Barcode, Buildings, CaretLeft, ChartBar,
  ClockCounterClockwise, Cube, EnvelopeSimple, Gear, ListChecks, ListPlus, Package,
  QrCode, SignOut, UserCircle, UserCheck, Wrench, X, ClipboardText, SlidersHorizontal
} from '@phosphor-icons/react';
import './AssetPortalShell.css';

const links = [
  { label: 'Overview', to: '/assets/dashboard', icon: ChartBar, end: true, group: 'WORKSPACE' },
  { label: 'Branch inventory', to: '/assets/branches', icon: Buildings, group: 'WORKSPACE' },
  { label: 'Asset register', to: '/assets/register', icon: Barcode, group: 'WORKSPACE' },
  { label: 'Assignments', to: '/assets/assignments', icon: UserCheck, group: 'WORKSPACE' },
  { label: 'QR labels', to: '/assets/qr', icon: QrCode, group: 'TRACKING' },
  { label: 'Approvals', to: '/assets/approvals', icon: ClipboardText, group: 'TRACKING' },
  { label: 'Transfers', to: '/assets/transfers', icon: ArrowsLeftRight, group: 'TRACKING' },
  { label: 'Activity history', to: '/assets/activity', icon: Activity, group: 'TRACKING' },
  { label: 'Consumable stock', to: '/assets/inventory', icon: Package, group: 'OPERATIONS' },
  { label: 'Maintenance', to: '/assets/maintenance', icon: Wrench, group: 'OPERATIONS' },
  { label: 'Retired items', to: '/assets/retired', icon: ClockCounterClockwise, group: 'OPERATIONS' },
  { label: 'Email reports', to: '/assets/mail', icon: EnvelopeSimple, group: 'OPERATIONS' },
  { label: 'Register an item', to: '/assets/add', icon: ListPlus, managerOnly: true, group: 'ADMINISTRATION' },
  { label: 'Workspace settings', to: '/assets/settings', icon: SlidersHorizontal, group: 'PREFERENCES' },
  { label: 'Asset setup', to: '/assets/setup', icon: Gear, adminOnly: true, group: 'ADMINISTRATION' }
];

const readAccount = () => {
  try { return JSON.parse(localStorage.getItem('tpoData') || '{}') || {}; }
  catch { return {}; }
};

const getDriveImage = (value, version = '') => {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
  const url = match ? `https://lh3.googleusercontent.com/d/${match[1]}` : value;
  return version ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}` : url;
};

const isAdminAccount = account => {
  const role = String(account?.role || '').trim().toUpperCase();
  return String(account?.accessType || '').trim().toLowerCase() === 'superadmin'
    || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
};

export default function AssetPortalShell({ children, user }) {
  const navigate = useNavigate();
  const [account, setAccount] = useState(user || readAccount());
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => { if (user) setAccount(user); }, [user]);
  useEffect(() => {
    const refreshAccount = () => setAccount(readAccount());
    window.addEventListener('portal-account-updated', refreshAccount);
    return () => window.removeEventListener('portal-account-updated', refreshAccount);
  }, []);
  const role = String(account.role || '').toUpperCase();
  const isAdmin = isAdminAccount(account);
  const isBranchManager = role === 'BM' || role.includes('BRANCH MANAGER');
  const canManage = isAdmin || isBranchManager || role.includes('ASSET') || String(account.accessType || '').toLowerCase().includes('asset');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const displayName = account.name || account.email || 'Staff member';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const photoUrl = getDriveImage(account.photo || account.profilePhoto, account.photoUpdatedAt);
  useEffect(() => setPhotoFailed(false), [photoUrl]);
  const profileImage = photoUrl && !photoFailed;

  const closeNav = () => setMobileNavOpen(false);
  const signOut = () => {
    localStorage.removeItem('tpoData');
    navigate('/login', { replace: true });
  };

  return (
    <div className="asset-portal">
      {mobileNavOpen && <button className="asset-portal-scrim" aria-label="Close navigation" onClick={closeNav} />}
      <aside className={`asset-portal-sidebar${mobileNavOpen ? ' is-open' : ''}`} aria-label="Asset Management navigation">
        <div className="asset-portal-brand">
          <span className="asset-portal-brand-mark"><Cube size={22} weight="duotone" /></span>
          <span><b>IPCS</b><small>ASSET OPERATIONS</small></span>
          <button className="asset-portal-close" aria-label="Close navigation" onClick={closeNav}><X size={19} /></button>
        </div>

        <div className="asset-portal-account">
          <span className="asset-portal-avatar">{profileImage ? <img src={photoUrl} alt="" onError={() => setPhotoFailed(true)} /> : initials || <UserCircle size={20} />}</span>
          <span className="asset-portal-account-copy"><b>{displayName}</b><small>{account.role || 'Asset workspace'}</small></span>
        </div>

        <nav className="asset-portal-nav">
          {['WORKSPACE', 'TRACKING', 'OPERATIONS', 'PREFERENCES', 'ADMINISTRATION'].map(group => {
            const visibleLinks = links.filter(link => link.group === group && (!link.managerOnly || canManage) && (!link.adminOnly || isAdmin));
            return visibleLinks.length ? <section className="asset-nav-group" key={group}>
              <span className="asset-portal-nav-label">{group}</span>
              {visibleLinks.map(({ label, to, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={closeNav} className={({ isActive }) => `asset-portal-nav-link${isActive ? ' active' : ''}`}>
                <Icon size={19} weight="duotone" /><span>{label}</span>
                {to === '/assets/add' && <span className="asset-nav-add">+</span>}
              </NavLink>)}
            </section> : null;
          })}
        </nav>

        <div className="asset-portal-sidebar-footer">
          {isAdmin || /(^|\b)BM\b|BRANCH MANAGER/.test(role) ? (
            <button type="button" onClick={() => navigate('/dashboard')}><ArrowLeft size={17} /> Main portal</button>
          ) : null}
          <button type="button" onClick={signOut}><SignOut size={17} /> Sign out</button>
        </div>
      </aside>

      <div className="asset-portal-main">
        <header className="asset-portal-topbar">
          <button type="button" className="asset-portal-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><ListChecks size={20} /></button>
          <div className="asset-portal-crumb"><span>IPCS OPERATIONS</span><CaretLeft size={14} /><b>Asset Management</b></div>
          <div className="asset-portal-top-account"><span>{account.sittingBranch || 'All permitted branches'}</span><span className="asset-portal-avatar small">{profileImage ? <img src={photoUrl} alt="" onError={() => setPhotoFailed(true)} /> : initials || <UserCircle size={17} />}</span></div>
        </header>
        <div className="asset-portal-content">{children}</div>
      </div>
    </div>
  );
}
