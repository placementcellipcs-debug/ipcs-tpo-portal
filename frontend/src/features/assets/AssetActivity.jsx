import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRight, CircleNotch, Pulse as Activity, WarningCircle } from '@phosphor-icons/react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets/activity`);
      if (!response.data?.success) throw new Error(response.data?.message || 'Could not load the asset history.');
      setActivity(response.data.activity || []);
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Could not load the asset history.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <Layout><main className="asset-ops-page">
    <header className="asset-ops-hero activity-hero"><span className="asset-ops-hero-icon"><Activity size={23} weight="duotone" /></span><div><span className="asset-ops-eyebrow">LIFECYCLE RECORD</span><h1>Activity history</h1><p>See who changed an asset, what changed, and when across your permitted branches.</p></div><div className="asset-ops-hero-stat"><b>{activity.length.toLocaleString('en-IN')}</b><span>Recent records</span></div></header>
    {error && <div className="asset-ops-message error" role="alert"><WarningCircle size={18} />{error}<button onClick={() => void load()}>Retry</button></div>}
    <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>RECENT FIRST</span><h2>Asset timeline</h2></div><button className="asset-ops-refresh" onClick={() => void load()}>Refresh</button></div>{loading ? <div className="asset-ops-loading"><CircleNotch className="ph-spin" size={24} /> Loading activity…</div> : activity.length ? <div className="asset-activity-timeline">{activity.map((entry, index) => <article key={`${entry.historyId || entry.assetId}-${index}`}><span className="asset-activity-marker" /><div className="asset-activity-card"><header><span>{String(entry.action || 'ASSET UPDATED').replaceAll('_', ' ')}{entry.entityType ? ` · ${entry.entityType}` : ''}</span><time>{formatPortalDateTime(entry.timestamp, String(entry.timestamp || 'Date unavailable'))}</time></header><b>{entry.assetId || 'Asset record'} · {entry.branch || 'Branch unavailable'}</b>{(entry.oldValue || entry.newValue) && <p>{describeChange(entry.oldValue) || '—'} <ArrowRight size={14} /> {describeChange(entry.newValue) || '—'}</p>}{entry.remarks && <small>{entry.remarks}</small>}<small>Recorded by {entry.performedBy || 'System'}{entry.actorRole ? ` · ${entry.actorRole}` : ''}</small></div></article>)}</div> : <div className="asset-ops-empty"><Activity size={23} /><b>No activity records yet</b><span>Asset actions will appear here after they are recorded in the history sheet.</span></div>}</section>
  </main></Layout>;
}
