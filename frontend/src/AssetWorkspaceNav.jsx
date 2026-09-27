import { NavLink } from 'react-router-dom';
import { ArrowsLeftRight, Barcode, Buildings, ClockCounterClockwise, Package, Plus, UserCheck, Wrench, Gear } from '@phosphor-icons/react';
import './AssetManagement.css';

const entries = [
  { label: 'Branches & spaces', to: '/assets/branches', icon: Buildings },
  { label: 'Item register', to: '/assets/register', icon: Barcode },
  { label: 'Assignments', to: '/assets/assignments', icon: UserCheck },
  { label: 'Retired', to: '/assets/retired', icon: ClockCounterClockwise },
  { label: 'Transfers', to: '/assets/transfers', icon: ArrowsLeftRight },
  { label: 'Maintenance', to: '/assets/maintenance', icon: Wrench },
  { label: 'Consumables', to: '/assets/inventory', icon: Package },
  { label: 'Register item', to: '/assets/add', icon: Plus, manageOnly: true },
  { label: 'Vendors & settings', to: '/assets/settings', icon: Gear, adminOnly: true }
];

export default function AssetWorkspaceNav() {
  let user = {};
  try { user = JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { /* Fall back to read-only navigation. */ }
  const role = String(user.role || '').toUpperCase();
  const canManage = String(user.accessType || '').toLowerCase() === 'superadmin' || role.includes('ASSET') || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
  const isSuperAdmin = String(user.accessType || '').toLowerCase() === 'superadmin';

  return <nav className="asset-route-nav" aria-label="Asset workspaces">{entries.filter(entry => (!entry.manageOnly || canManage) && (!entry.adminOnly || isSuperAdmin)).map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `asset-route-link${isActive ? ' active' : ''}`}><Icon size={17} />{label}</NavLink>)}</nav>;
}
