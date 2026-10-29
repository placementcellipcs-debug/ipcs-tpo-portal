import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowRight, Barcode, BellRinging, Buildings, CheckCircle,
  CircleNotch, ClipboardText, Cube, EnvelopeSimple,
  Package, Pulse as Activity, QrCode, WarningCircle, Wrench
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDateTime } from '../../utils/dateFormat';
import './AssetDashboard.css';

const emptyStats = { totalAssets: 0, totalValue: null, assigned: 0, available: 0, underMaintenance: 0, branches: [], categories: [], lowStock: [], activeMaintenance: 0, pendingApprovals: 0, activityTrend: [], recentActivity: [], updatedAt: null };
const isAdminAccount = account => String(account?.accessType || '').toLowerCase() === 'superadmin'
  || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(String(account?.role || '').trim().toUpperCase());
const formatCurrency = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
const actionTitle = value => String(value || 'Asset updated').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());

const shortcuts = [
  { title: 'Scan & label', detail: 'Create item QR labels', path: '/assets/qr', icon: QrCode, tone: 'mint' },
  { title: 'Approvals', detail: 'Review branch transfers', path: '/assets/approvals', icon: ClipboardText, tone: 'violet' },
  { title: 'Item register', detail: 'Search every tracked item', path: '/assets/register', icon: Barcode, tone: 'blue' },
  { title: 'Email center', detail: 'Send an asset summary', path: '/assets/mail', icon: EnvelopeSimple, tone: 'amber' }
];
const categoryPalette = ['#37d9c2', '#9292ff', '#ffae63', '#ff76a9', '#61b8ff', '#b69bff', '#c3e86a'];

export default function AssetDashboard() {
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  let account = {};
  try { account = JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { /* The route gate handles an invalid session. */ }
  const canSeeValue = isAdminAccount(account);

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets/dashboard`);
      if (!response.data?.success) throw new Error(response.data?.message || 'Asset summary is unavailable.');
      setStats({ ...emptyStats, ...(response.data.stats || {}) });
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not load the asset summary.'); }
    finally { if (showLoading) setLoading(false); }
  }, []);

  useEffect(() => {
    void loadDashboard(true);
    const timer = window.setInterval(() => void loadDashboard(false), 60_000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const total = Number(stats.totalAssets || 0);
  const cards = [
    { label: 'Tracked items', value: total, hint: 'Across your permitted branches', icon: Cube, tone: 'blue' },
    { label: 'Assigned to staff', value: Number(stats.assigned || 0), hint: 'Items currently in use', icon: Barcode, tone: 'violet' },
    { label: 'Available', value: Number(stats.available || 0), hint: 'Ready for handover', icon: CheckCircle, tone: 'green' },
    { label: 'Awaiting approval', value: Number(stats.pendingApprovals || 0), hint: 'Transfer requests', icon: ClipboardText, tone: 'pink', to: '/assets/approvals' },
    { label: 'Service tickets', value: Number(stats.activeMaintenance || 0), hint: 'Open maintenance issues', icon: Wrench, tone: 'amber', to: '/assets/maintenance' }
  ];
  const trend = stats.activityTrend?.length ? stats.activityTrend : [];

  return <Layout><main className="asset-dashboard-page">
    <header className="asset-dashboard-hero">
      <div className="asset-dashboard-hero-copy"><span className="asset-dashboard-eyebrow"><i /> ASSET INTELLIGENCE</span><h1>Everything your branches own.<br /><em>One live view.</em></h1><p>Follow every item from registration to handover, transfer, repair, and retirement.</p>
        <div className="asset-dashboard-hero-actions"><Link className="asset-dashboard-primary" to="/assets/register">Explore asset register <ArrowRight size={17} /></Link><Link className="asset-dashboard-quiet-link" to="/assets/qr"><QrCode size={17} /> Create QR labels</Link></div>
      </div>
      <div className="asset-lifecycle-visual" aria-label="Asset lifecycle: registered, assigned, tracked, serviced"><div className="asset-lifecycle-orbit orbit-one" /><div className="asset-lifecycle-orbit orbit-two" /><span className="asset-lifecycle-core"><Cube size={31} weight="duotone" /></span><span className="asset-lifecycle-node node-register"><Barcode size={17} /><small>REGISTER</small></span><span className="asset-lifecycle-node node-assign"><BellRinging size={17} /><small>ASSIGN</small></span><span className="asset-lifecycle-node node-track"><QrCode size={17} /><small>TRACK</small></span><span className="asset-lifecycle-node node-care"><Wrench size={17} /><small>CARE</small></span></div>
      <div className="asset-dashboard-sync"><span className="asset-sync-dot" /><span>Sheet data</span><b>{stats.updatedAt ? `Synced ${formatPortalDateTime(stats.updatedAt, '')}` : 'Waiting for first sync'}</b><button onClick={() => void loadDashboard(true)} aria-label="Refresh asset dashboard"><CircleNotch size={15} /> Refresh</button></div>
    </header>

    {error && <div className="asset-dashboard-error" role="alert"><WarningCircle size={19} /><span>{error}</span><button type="button" onClick={() => void loadDashboard(true)}>Try again</button></div>}
    {loading ? <div className="asset-dashboard-loading" role="status"><CircleNotch size={30} className="ph-spin" /><span>Loading branch asset activity…</span></div> : <>
      <section className="asset-dashboard-metrics" aria-label="Asset summary">{cards.map(({ label, value, hint, icon: Icon, tone, to }) => <article className={`asset-metric-card ${tone}`} key={label}>{to ? <Link to={to} aria-label={`Open ${label}`} /> : null}<span className="asset-metric-icon"><Icon size={21} weight="duotone" /></span><div className="asset-metric-copy"><span>{label}</span><strong>{value.toLocaleString('en-IN')}</strong><small>{hint}</small></div></article>)}{canSeeValue && stats.totalValue != null && <article className="asset-metric-card cyan"><span className="asset-metric-icon">₹</span><div className="asset-metric-copy"><span>Recorded value</span><strong>{formatCurrency(stats.totalValue)}</strong><small>Registered purchase costs</small></div></article>}</section>

      <section className="asset-dashboard-command-row">{shortcuts.map(({ title, detail, path, icon: Icon, tone }) => <Link className={`asset-shortcut ${tone}`} to={path} key={title}><span><Icon size={20} weight="duotone" /></span><div><b>{title}</b><small>{detail}</small></div><ArrowRight size={17} /></Link>)}</section>

      <div className="asset-dashboard-main-grid">
        <section className="asset-dashboard-panel asset-trend-panel"><div className="asset-panel-heading"><div><span>ASSET LIFECYCLE SIGNAL</span><h2>Asset movement over time</h2><p>Recorded changes from the activity and history sheets · updates on the scheduled sheet sync</p></div><span className="asset-live-pill"><i /> SHEET SYNC</span></div>
          {trend.some(item => Number(item.events) > 0) ? <div className="asset-trend-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}><defs><linearGradient id="assetActivityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#48e0bd" stopOpacity={0.32} /><stop offset="95%" stopColor="#48e0bd" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(147,171,191,.1)" strokeDasharray="3 6" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#7d92a8', fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#71869b', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#102033', border: '1px solid rgba(72,224,189,.24)', borderRadius: 12, color: '#f0faf7' }} labelStyle={{ color: '#a7bbca' }} /><Area type="monotone" dataKey="events" name="Recorded actions" stroke="#48e0bd" strokeWidth={3} fill="url(#assetActivityFill)" activeDot={{ r: 5, fill: '#9af2d8', stroke: '#153c39', strokeWidth: 3 }} /></AreaChart></ResponsiveContainer></div> : <div className="asset-dashboard-chart-empty"><Activity size={23} /><b>Activity will draw the trend</b><span>When assets are registered, assigned, transferred, or serviced, the chart will reflect those sheet records.</span></div>}
          <div className="asset-trend-foot"><span><i /> Asset history and activity records</span><Link to="/assets/activity">Open activity history <ArrowRight size={14} /></Link></div>
        </section>

        <section className="asset-dashboard-panel asset-branch-panel"><div className="asset-panel-heading"><div><span>WHERE ITEMS ARE</span><h2>Branch inventory</h2></div><Buildings size={20} /></div>{stats.branches?.length ? <div className="asset-branch-list">{stats.branches.slice(0, 7).map(branch => { const share = total ? Math.max(2, Math.round(Number(branch.value || 0) / total * 100)) : 0; return <div className="asset-branch-row" key={branch.name}><div><b>{branch.name}</b><span>{Number(branch.value || 0).toLocaleString('en-IN')} items</span></div><div className="asset-branch-meter"><i style={{ width: `${share}%` }} /></div></div>; })}</div> : <div className="asset-dashboard-empty">No branch inventory is available in this account’s scope.</div>}<Link className="asset-panel-link" to="/assets/branches">Explore branches <ArrowRight size={15} /></Link></section>

        <section className="asset-dashboard-panel asset-category-panel"><div className="asset-panel-heading"><div><span>PORTFOLIO MIX</span><h2>Items by category</h2></div><Package size={20} /></div>{stats.categories?.length ? <div className="asset-category-list">{stats.categories.slice(0, 7).map((category, index) => { const peak = Math.max(...stats.categories.map(item => Number(item.value || 0)), 1); const count = Number(category.value || 0); return <div className="asset-category-row" key={category.name}><div><span className="asset-category-dot" style={{ '--category-color': categoryPalette[index % categoryPalette.length] }} /><b>{category.name}</b><strong>{count.toLocaleString('en-IN')}</strong></div><div className="asset-category-meter"><i style={{ width: `${Math.max(3, count / peak * 100)}%`, '--category-color': categoryPalette[index % categoryPalette.length] }} /></div></div>; })}</div> : <div className="asset-dashboard-empty">Category totals will appear as assets are registered.</div>}</section>

        <section className="asset-dashboard-panel asset-activity-panel"><div className="asset-panel-heading"><div><span>RECENT CHANGES</span><h2>Tracking feed</h2></div><Link to="/assets/activity">View all <ArrowRight size={14} /></Link></div>{stats.recentActivity?.length ? <div className="asset-feed-list">{stats.recentActivity.slice(0, 5).map((entry, index) => <article key={`${entry.historyId || entry.assetId}-${index}`}><span className="asset-feed-icon"><Activity size={16} /></span><div><b>{actionTitle(entry.action)}</b><small>{entry.assetId} · {entry.branch || 'Branch'}</small></div><time>{formatPortalDateTime(entry.timestamp, String(entry.timestamp || ''))}</time></article>)}</div> : <div className="asset-dashboard-empty">New asset actions will appear here as they are recorded.</div>}</section>

        <section className="asset-dashboard-panel asset-alert-panel"><div className="asset-panel-heading"><div><span>ATTENTION NEEDED</span><h2>Operations signals</h2></div><WarningCircle size={20} /></div><div className="asset-signal-list"><Link to="/assets/approvals"><span className="asset-signal-icon violet"><ClipboardText size={17} /></span><div><b>Transfer approvals</b><small>Waiting for a decision</small></div><strong>{Number(stats.pendingApprovals || 0)}</strong><ArrowRight size={15} /></Link><Link to="/assets/maintenance"><span className="asset-signal-icon amber"><Wrench size={17} /></span><div><b>Open service tickets</b><small>Assets awaiting repair</small></div><strong>{Number(stats.activeMaintenance || 0)}</strong><ArrowRight size={15} /></Link><Link to="/assets/inventory"><span className="asset-signal-icon rose"><Package size={17} /></span><div><b>Low stock alerts</b><small>Consumables at or below minimum</small></div><strong>{stats.lowStock?.length || 0}</strong><ArrowRight size={15} /></Link></div></section>
      </div>
    </>}
  </main></Layout>;
}
