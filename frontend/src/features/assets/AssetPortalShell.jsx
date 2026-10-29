import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowsLeftRight, Barcode, Buildings, CaretLeft, ChartBar,
  ClockCounterClockwise, Cube, Gear, ListChecks, ListPlus, Package,
  SignOut, UserCircle, UserCheck, Wrench, X
} from '@phosphor-icons/react';
import './AssetPortalShell.css';

const links = [
  { label: 'Dashboard', to: '/assets/dashboard', icon: ChartBar, end: true },
  { label: 'Branches & spaces', to: '/assets/branches', icon: Buildings },
  { label: 'Item register', to: '/assets/register', icon: Barcode },
  { label: 'Assignments', to: '/assets/assignments', icon: UserCheck },
  { label: 'Retired items', to: '/assets/retired', icon: ClockCounterClockwise },
  { label: 'Consumable stock', to: '/assets/inventory', icon: Package },
  { label: 'Transfers', to: '/assets/transfers', icon: ArrowsLeftRight },
  { label: 'Maintenance', to: '/assets/maintenance', icon: Wrench },
  { label: 'Register an item', to: '/assets/add', icon: ListPlus, managerOnly: true },
  { label: 'System settings', to: '/assets/settings', icon: Gear, adminOnly: true }
];

const readAccount = () => {
  try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); }
  catch { return {}; }
};

const isAdminAccount = account => {
  const role = String(account?.role || '').trim().toUpperCase();
  return String(account?.accessType || '').trim().toLowerCase() === 'superadmin'
    || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
};

export default function AssetPortalShell({ children, user }) {
  const navigate = useNavigate();
  const account = user || readAccount();
  const role = String(account.role || '').toUpperCase();
  const isAdmin = isAdminAccount(account);
  const canManage = isAdmin || role.includes('ASSET') || String(account.accessType || '').toLowerCase().includes('asset');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const displayName = account.name || account.email || 'Staff member';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

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
          <span className="asset-portal-avatar">{initials || <UserCircle size={20} />}</span>
          <span className="asset-portal-account-copy"><b>{displayName}</b><small>{account.role || 'Asset workspace'}</small></span>
        </div>

        <span className="asset-portal-nav-label">ASSET WORKSPACE</span>
        <nav className="asset-portal-nav">
          {links.filter(link => (!link.managerOnly || canManage) && (!link.adminOnly || isAdmin)).map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={closeNav} className={({ isActive }) => `asset-portal-nav-link${isActive ? ' active' : ''}`}>
              <Icon size={19} weight="duotone" /><span>{label}</span>
              {to === '/assets/add' && <span className="asset-nav-add">+</span>}
            </NavLink>
          ))}
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
          <div className="asset-portal-top-account"><span>{account.sittingBranch || 'All permitted branches'}</span><span className="asset-portal-avatar small">{initials || <UserCircle size={17} />}</span></div>
        </header>
        <div className="asset-portal-content">{children}</div>
      </div>
    </div>
  );
}
