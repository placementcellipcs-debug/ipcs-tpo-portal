import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowsLeftRight, Barcode, Buildings, CircleNotch,
  ClockCounterClockwise, Cube, Package, WarningCircle, Wrench
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import './AssetDashboard.css';

const emptyStats = { totalAssets: 0, totalValue: null, assigned: 0, available: 0, underMaintenance: 0, branches: [], categories: [], lowStock: [], activeMaintenance: 0 };
const isAdminAccount = account => String(account?.accessType || '').toLowerCase() === 'superadmin'
  || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(String(account?.role || '').trim().toUpperCase());

const formatCurrency = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function AssetDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  let account = {};
  try { account = JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { /* The route gate redirects invalid sessions. */ }
  const canSeeValue = isAdminAccount(account);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets/dashboard`);
      if (!response.data?.success) throw new Error(response.data?.message || 'Asset summary is unavailable.');
      setStats({ ...emptyStats, ...(response.data.stats || {}) });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not load the asset summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const total = Number(stats?.totalAssets || 0);
  const branches = stats?.branches || [];
  const categories = stats?.categories || [];
  const lowStock = stats?.lowStock || [];
  const cards = [
    { label: 'Tracked items', value: total, hint: 'Items in the asset register', icon: Cube, tone: 'blue' },
    { label: 'Assigned', value: Number(stats?.assigned || 0), hint: 'Currently with staff', icon: Barcode, tone: 'violet' },
    { label: 'Available', value: Number(stats?.available || 0), hint: 'Ready for assignment', icon: Package, tone: 'green' },
    { label: 'In maintenance', value: Number(stats?.underMaintenance || 0), hint: `${Number(stats?.activeMaintenance || 0)} open service tickets`, icon: Wrench, tone: 'amber' }
  ];

  return (
    <Layout>
      <div className="asset-dashboard-page">
        <header className="asset-dashboard-heading">
          <div><span className="asset-dashboard-eyebrow">ASSET OPERATIONS</span><h1>Asset dashboard</h1><p>Track equipment, assignments, stock, transfers, and service across your permitted branches.</p></div>
          <Link className="asset-dashboard-primary" to="/assets/branches">Open workspace <ArrowRight size={17} /></Link>
        </header>

        {error && <div className="asset-dashboard-error" role="alert"><WarningCircle size={19} /><span>{error}</span><button type="button" onClick={() => void loadDashboard()}>Try again</button></div>}

        {loading ? (
          <div className="asset-dashboard-loading" role="status"><CircleNotch size={30} className="ph-spin" /><span>Loading asset summary…</span></div>
        ) : (
          <>
            <section className="asset-dashboard-metrics" aria-label="Asset summary">
              {cards.map(({ label, value, hint, icon: Icon, tone }) => <article className={`asset-metric-card ${tone}`} key={label}>
                <span className="asset-metric-icon"><Icon size={20} weight="duotone" /></span><div className="asset-metric-copy"><span>{label}</span><strong>{value.toLocaleString('en-IN')}</strong><small>{hint}</small></div>
              </article>)}
              {canSeeValue && stats?.totalValue != null && <article className="asset-metric-card cyan"><span className="asset-metric-icon">₹</span><div className="asset-metric-copy"><span>Recorded purchase value</span><strong>{formatCurrency(stats.totalValue)}</strong><small>From registered purchase costs</small></div></article>}
            </section>

            <div className="asset-dashboard-grid">
              <section className="asset-dashboard-panel asset-branch-panel">
                <div className="asset-panel-heading"><div><span>WHERE ITEMS ARE</span><h2>Branch inventory</h2></div><Link to="/assets/branches">View branches <ArrowRight size={15} /></Link></div>
                {branches.length ? <div className="asset-branch-list">{branches.slice(0, 8).map(branch => {
                  const share = total ? Math.max(4, Math.round((Number(branch.value || 0) / total) * 100)) : 0;
                  return <div className="asset-branch-row" key={branch.name}><span className="asset-branch-icon"><Buildings size={17} /></span><div className="asset-branch-row-main"><div><b>{branch.name}</b><span>{Number(branch.value || 0).toLocaleString('en-IN')} items</span></div><div className="asset-branch-meter"><i style={{ width: `${share}%` }} /></div></div></div>;
                })}</div> : <div className="asset-dashboard-empty">No branch asset records are available.</div>}
              </section>

              <section className="asset-dashboard-panel asset-action-panel">
                <div className="asset-panel-heading"><div><span>QUICK ACCESS</span><h2>Asset workspace</h2></div></div>
                <div className="asset-quick-links">
                  <Link to="/assets/register"><Barcode size={19} /><span><b>Item register</b><small>Search and review equipment</small></span><ArrowRight size={16} /></Link>
                  <Link to="/assets/assignments"><Cube size={19} /><span><b>Assignments</b><small>See current item holders</small></span><ArrowRight size={16} /></Link>
                  <Link to="/assets/inventory"><Package size={19} /><span><b>Consumable stock</b><small>Track supplies and quantities</small></span><ArrowRight size={16} /></Link>
                  <Link to="/assets/transfers"><ArrowsLeftRight size={19} /><span><b>Transfers</b><small>Follow items between branches</small></span><ArrowRight size={16} /></Link>
                  <Link to="/assets/maintenance"><Wrench size={19} /><span><b>Maintenance</b><small>Review service tickets</small></span><ArrowRight size={16} /></Link>
                  <Link to="/assets/retired"><ClockCounterClockwise size={19} /><span><b>Retired items</b><small>Review disposal history</small></span><ArrowRight size={16} /></Link>
                </div>
              </section>

              <section className="asset-dashboard-panel asset-category-panel">
                <div className="asset-panel-heading"><div><span>REGISTER BREAKDOWN</span><h2>By category</h2></div></div>
                {categories.length ? <div className="asset-category-list">{categories.slice(0, 6).map((category, index) => <div className="asset-category-row" key={category.name}><span className={`asset-category-dot dot-${index % 5}`} /><b>{category.name}</b><span>{Number(category.value || 0).toLocaleString('en-IN')}</span></div>)}</div> : <div className="asset-dashboard-empty">Category totals will appear when items are registered.</div>}
              </section>

              <section className="asset-dashboard-panel asset-alert-panel">
                <div className="asset-panel-heading"><div><span>FOLLOW UP</span><h2>Needs attention</h2></div></div>
                {lowStock.length || Number(stats?.activeMaintenance || 0) ? <div className="asset-alert-list">
                  {Number(stats?.activeMaintenance || 0) > 0 && <Link to="/assets/maintenance" className="asset-alert-row"><span className="asset-alert-icon amber"><Wrench size={17} /></span><span><b>Open maintenance tickets</b><small>Assets currently awaiting service</small></span><strong>{stats.activeMaintenance}</strong></Link>}
                  {lowStock.slice(0, 5).map((item, index) => <Link to="/assets/inventory" className="asset-alert-row" key={`${item.name}-${item.branch}-${index}`}><span className="asset-alert-icon red"><WarningCircle size={17} /></span><span><b>{item.name || 'Low stock item'}</b><small>{item.branch || 'Branch'} · minimum {item.min}</small></span><strong>{item.qty} left</strong></Link>)}
                </div> : <div className="asset-dashboard-clear"><span><Cube size={21} /></span><b>No urgent follow-up</b><small>There are no open repairs or low-stock alerts in your branch scope.</small></div>}
              </section>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
