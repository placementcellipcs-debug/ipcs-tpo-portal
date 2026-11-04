import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRight, CircleNotch, MagnifyingGlass, Pulse as Activity, WarningCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDateTime } from '../../utils/dateFormat';
import './AssetOperationsCenter.css';

const describeChange = value => {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return String(value);
    return Object.entries(parsed).slice(0, 4).map(([key, entry]) => `${key.replaceAll('_', ' ')}: ${String(entry)}`).join(' · ');
  } catch { return String(value); }
};

export default function AssetActivity() {
  const [activity, setActivity] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (filters = {}) => {
    setLoading(true); setError('');
    try {
      const [activityResponse, assetResponse] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/assets/activity`, { params: filters }),
        assets.length ? Promise.resolve(null) : axios.get(`${API_BASE}/api/v1/assets`)
      ]);
      if (!activityResponse.data?.success) throw new Error(activityResponse.data?.message || 'Could not load the asset history.');
      setActivity(activityResponse.data.activity || []);
      if (assetResponse?.data?.success) setAssets(assetResponse.data.assets || []);
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not load the asset history.'); }
    finally { setLoading(false); }
  }, [assets.length]);
  useEffect(() => { void load({}); }, [load]);
  const applyFilters = event => { event.preventDefault(); void load({ ...(selectedAsset ? { assetId: selectedAsset } : {}), ...(search.trim() ? { q: search.trim() } : {}) }); };
  const refresh = () => void load({ ...(selectedAsset ? { assetId: selectedAsset } : {}), ...(search.trim() ? { q: search.trim() } : {}) });
  return <Layout><main className="asset-ops-page">
    <header className="asset-ops-hero activity-hero"><span className="asset-ops-hero-icon"><Activity size={23} weight="duotone" /></span><div><span className="asset-ops-eyebrow">LIFECYCLE RECORD</span><h1>Activity history</h1><p>Filter the timeline to a single item, or search across items and recorded actions.</p></div><div className="asset-ops-hero-stat"><b>{activity.length.toLocaleString('en-IN')}</b><span>Matching records</span></div></header>
    {error && <div className="asset-ops-message error" role="alert"><WarningCircle size={18} />{error}<button onClick={refresh}>Retry</button></div>}
    <section className="asset-ops-panel">
      <div className="asset-ops-section-head"><div><span>FIND A SPECIFIC CHANGE</span><h2>Filter the asset timeline</h2></div><button className="asset-ops-refresh" onClick={refresh}>Refresh</button></div>
      <form className="asset-history-filters" onSubmit={applyFilters}>
        <label><span>Asset item</span><select value={selectedAsset} onChange={event => setSelectedAsset(event.target.value)}><option value="">All permitted items</option>{assets.map(asset => <option key={asset.assetId} value={asset.assetId}>{asset.name || 'Unnamed item'} · {asset.assetId}</option>)}</select></label>
        <label className="asset-history-query"><span>Search</span><div className="asset-ops-search"><MagnifyingGlass size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Item, branch, action, or staff name" /></div></label>
        <button className="asset-history-apply" type="submit">Apply filters</button>
      </form>
    </section>
    <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>RECENT FIRST</span><h2>{selectedAsset ? `Timeline · ${selectedAsset}` : 'Asset timeline'}</h2></div></div>{loading ? <div className="asset-ops-loading"><CircleNotch className="ph-spin" size={24} /> Loading activity…</div> : activity.length ? <div className="asset-activity-timeline">{activity.map((entry, index) => <article key={`${entry.historyId || entry.assetId}-${index}`}><span className="asset-activity-marker" /><div className="asset-activity-card"><header><span>{String(entry.action || 'ASSET UPDATED').replaceAll('_', ' ')}{entry.entityType ? ` · ${entry.entityType}` : ''}</span><time>{formatPortalDateTime(entry.timestamp, String(entry.timestamp || 'Date unavailable'))}</time></header><b>{entry.assetId || 'Asset record'} · {entry.branch || 'Branch unavailable'}</b>{(entry.oldValue || entry.newValue) && <p>{describeChange(entry.oldValue) || '—'} <ArrowRight size={14} /> {describeChange(entry.newValue) || '—'}</p>}{entry.remarks && <small>{entry.remarks}</small>}<small>Recorded by {entry.performedBy || 'System'}{entry.actorRole ? ` · ${entry.actorRole}` : ''}</small></div></article>)}</div> : <div className="asset-ops-empty"><Activity size={23} /><b>No matching history</b><span>Try another asset or clear the search filters.</span></div>}</section>
  </main></Layout>;
}
