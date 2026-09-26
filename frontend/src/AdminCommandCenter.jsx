import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, Buildings, ChartLineUp, CircleNotch, GearSix, GraduationCap, Handshake, Images, Package, ShieldCheck, UsersFour } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';
import './AdminCommandCenter.css';

const readUser = () => {
  try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); }
  catch { return {}; }
};
const isAdminAccount = account => {
  const role = String(account?.role || '').toUpperCase();
  return String(account?.accessType || '').toLowerCase() === 'superadmin' ||
    ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
};
const payloadOf = result => result.status === 'fulfilled' ? result.value?.data || {} : {};
const number = value => value === null || value === undefined ? '—' : Number(value || 0).toLocaleString('en-IN');

const moduleRoutes = [
  { id: 'placements', title: 'Placements', icon: Handshake, path: '/dashboard', color: 'blue', description: 'Students, placement progress, employer relationships, vacancies, and drives.', links: [['Dashboard', '/dashboard'], ['Student directory', '/students'], ['Placement drives', '/placement-drives'], ['Clients & partners', '/clients']] },
  { id: 'ops', title: 'Academic & Ops', icon: Buildings, path: '/events', color: 'teal', description: 'Events, issue resolution, Talentino activities, and branch operations.', links: [['Events', '/events'], ['Issue resolution', '/issues'], ['Talentino', '/talentino'], ['Branches', '/branches']] },
  { id: 'training', title: 'Training & Academics', icon: GraduationCap, path: '/academic/training', color: 'green', description: 'Training assignments, batches, live sessions, attendance, and student diaries.', links: [['Training', '/academic/training'], ['Batches', '/academic/batches'], ['Live sessions', '/academic/sessions'], ['Attendance', '/academic/attendance'], ['Student diary', '/academic/diary']] },
  { id: 'media', title: 'Media & Design Studio', icon: Images, path: '/media/dashboard', color: 'pink', description: 'Creative queue, previews, files, social posts, categories, and activity.', links: [['Active queues', '/media/dashboard'], ['Preview gallery', '/media/preview'], ['File vault', '/media/files'], ['Social media', '/media/social']] },
  { id: 'assets', title: 'Asset Management', icon: Package, path: '/assets', color: 'amber', description: 'Branch spaces, item register, assignments, asset condition history, and disposal.', links: [['Branches & items', '/assets'], ['Register an item', '/assets/add'], ['Transfers', '/assets/transfers'], ['Maintenance', '/assets/maintenance'], ['Consumables', '/assets/inventory'], ['Vendors & settings', '/assets/settings']] },
  { id: 'system', title: 'System Admin', icon: ShieldCheck, path: '/users', color: 'violet', description: 'User access, branches, courses, and security activity.', links: [['Users', '/users'], ['Branches', '/branches'], ['Courses', '/courses'], ['Security logs', '/security-logs']] },
  { id: 'settings', title: 'Settings', icon: GearSix, path: '/settings', color: 'slate', description: 'Your account settings and workspace preferences.', links: [['Open settings', '/settings']] }
];

export default function AdminCommandCenter() {
  const navigate = useNavigate();
  const user = useMemo(readUser, []);
  const [summary, setSummary] = useState({ loading: true, placements: null, assets: null, academic: null, media: null, users: null, branches: null });

  useEffect(() => {
    if (!isAdminAccount(user)) { navigate('/dashboard', { replace: true }); return; }
    let active = true;
    const placementRequest = axios.post(`${API_BASE}/api/tpo/dashboard-stats`, {
      assignedBranchesArray: user.assignedBranchesArray || [], role: user.role || '', assignedCourse: user.assignedCourse || '', tpoName: user.name || '', isDashboard: true
    });
    Promise.allSettled([
      placementRequest,
      axios.get(`${API_BASE}/api/v1/assets/dashboard`),
      axios.get(`${API_BASE}/api/academic/data`),
      axios.get(`${API_BASE}/api/design/tasks`),
      axios.get(`${API_BASE}/api/admin/users`),
      axios.get(`${API_BASE}/api/admin/branches`)
    ]).then(results => {
      if (!active) return;
      const [placements, assets, academic, media, users, branches] = results.map(payloadOf);
      setSummary({
        loading: false,
        placements: placements.stats || null,
        events: placements.events || [],
        assets: assets.stats || null,
        academic: academic.success ? academic : null,
        media: media.success ? media : null,
        users: users.success && Array.isArray(users.users) ? users.users.length : null,
        branches: branches.success && Array.isArray(branches.branches) ? branches.branches.length : null
      });
    });
    return () => { active = false; };
  }, [navigate, user]);

  if (!isAdminAccount(user)) return null;
  const placementStats = summary.placements || {};
  const assetStats = summary.assets || {};
  const academic = summary.academic || {};
  const media = summary.media || {};
  const taskList = Array.isArray(media.tasks) ? media.tasks : [];
  const summaryLines = {
    placements: [[number(summary.placements && placementStats.totalStudents), 'students'], [number(summary.placements && placementStats.placed), 'placed'], [number(summary.placements && placementStats.activeVacancies), 'open vacancies']],
    ops: [[number(summary.placements && (summary.events || []).length), 'recent events'], [number(summary.placements && placementStats.totalCompanies), 'employer network'], ['Live', 'operations']],
    training: [[number(summary.academic && (academic.training || []).length), 'training records'], [number(summary.academic && (academic.batches || []).length), 'batches'], [number(summary.academic && (academic.sessions || []).length), 'sessions']],
    media: [[number(summary.media && taskList.length), 'creative tasks'], [number(summary.media && taskList.filter(task => !/complete|published/i.test(String(task.status || ''))).length), 'in progress'], [number(summary.media && (media.social || []).length), 'social posts']],
    assets: [[number(summary.assets && (assetStats.totalAssets ?? assetStats.total)), 'tracked items'], [number(summary.assets && assetStats.assigned), 'assigned'], [number(summary.assets && assetStats.underMaintenance), 'in maintenance']],
    system: [[number(summary.users), 'team accounts'], [number(summary.branches), 'branches'], ['Access', 'and audit controls']],
    settings: [['Profile', 'account details'], ['Workspace', 'preferences'], ['Support', 'help & access']]
  };
  const topMetrics = [
    { label: 'Students', value: placementStats.totalStudents, icon: UsersFour },
    { label: 'Placed', value: placementStats.placed, icon: ChartLineUp },
    { label: 'Tracked assets', value: assetStats.totalAssets ?? assetStats.total, icon: Package },
    { label: 'Branches', value: summary.branches, icon: Buildings }
  ];

  return (
    <Layout>
      <main className="admin-command">
        <header className="admin-command-hero">
          <div><span className="admin-command-eyebrow">IPCS GLOBAL · ADMIN OVERVIEW</span><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {String(user.name || 'Admin').split(' ')[0]}.</h1><p>Your network at a glance. Choose a workspace to continue where you need to work.</p></div>
          <div className="admin-command-live"><span /> Live workspace summary</div>
        </header>
        <section className="admin-command-metrics" aria-label="Network summary">
          {topMetrics.map(({ label, value, icon: Icon }) => <article key={label}><span className="admin-metric-icon"><Icon size={20} weight="duotone" /></span><div><small>{label}</small><strong>{summary.loading ? <CircleNotch className="ph-spin" size={17} /> : number(value)}</strong></div></article>)}
        </section>
        <div className="admin-command-section-title"><div><span>YOUR WORKSPACES</span><h2>Choose a module</h2></div><p>Each module opens its existing workspace and tools.</p></div>
        <section className="admin-module-grid" aria-label="Admin workspaces">
          {moduleRoutes.map(({ id, title, icon: Icon, path, color, description, links }) => (
            <article className={`admin-module-card module-${color}`} key={id}>
              <button type="button" className="admin-module-main" onClick={() => navigate(path)}>
                <span className="admin-module-icon"><Icon size={23} weight="duotone" /></span><span className="admin-module-open"><ArrowRight size={18} /></span>
                <span className="admin-module-title">{title}</span><span className="admin-module-description">{description}</span>
              </button>
              <div className="admin-module-summary">{summaryLines[id].map(([value, label]) => <div key={label}><b>{summary.loading ? '—' : value}</b><span>{label}</span></div>)}</div>
              <nav className="admin-module-links" aria-label={`${title} pages`}>{links.map(([label, route]) => <button type="button" key={route} onClick={() => navigate(route)}>{label}<ArrowRight size={13} /></button>)}</nav>
            </article>
          ))}
        </section>
        {summary.loading && <div className="admin-command-sync"><CircleNotch size={15} className="ph-spin" /> Updating live module totals…</div>}
      </main>
    </Layout>
  );
}
