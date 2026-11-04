import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Barcode, CircleNotch, ClockCounterClockwise, MapPinLine, Package, WarningCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDateTime } from '../../utils/dateFormat';
import './AssetItemPage.css';

const display = value => value === null || value === undefined || value === '' ? '—' : String(value);

export default function AssetItemPage() {
  const { assetId = '' } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets/${encodeURIComponent(assetId)}/details`);
      if (!response.data?.success) throw new Error(response.data?.message || 'This item could not be opened.');
      setData(response.data);
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'This item could not be opened.'); }
    finally { setLoading(false); }
  }, [assetId]);
  useEffect(() => { void load(); }, [load]);
  const asset = data?.asset || {};
  const assignments = data?.assignments || [];
  const currentAssignment = assignments.find(record => ['ACTIVE', 'ASSIGNED'].includes(String(record.status || '').trim().toUpperCase())) || assignments[0];
  return <Layout><main className="asset-ops-page asset-item-page">
    <Link className="asset-item-back" to="/assets/register"><ArrowLeft size={17} /> Back to asset register</Link>
    {error && <div className="asset-ops-message error" role="alert"><WarningCircle size={18} />{error}<button onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="asset-ops-panel asset-item-loading"><CircleNotch size={25} className="ph-spin" /> Loading item details…</div> : data && <>
      <header className="asset-ops-hero asset-item-hero"><span className="asset-ops-hero-icon"><Barcode size={23} weight="duotone" /></span><div><span className="asset-ops-eyebrow">IPCS ASSET IDENTIFICATION</span><h1>{display(asset.name)}</h1><p>{display(asset.assetId)} · {display(asset.category)}{asset.subcategory ? ` / ${asset.subcategory}` : ''}</p></div><span className={`asset-ops-status ${String(asset.status || 'available').toLowerCase()}`}>{String(asset.status || 'AVAILABLE').replaceAll('_', ' ')}</span></header>
      <section className="asset-item-location"><MapPinLine size={20} /><div><b>{display(asset.branch)}</b><span>{display(asset.location)}</span></div><span className="asset-item-location-condition">{display(asset.condition)} condition</span></section>
      <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>ITEM RECORD</span><h2>Asset details</h2></div></div><div className="asset-item-grid">
        {[
          ['Category', asset.category], ['Subcategory', asset.subcategory], ['Tracking mode', asset.trackingMode === 'QUANTITY' ? `Quantity group · ${asset.quantity} units` : 'Individual item'],
          ['Brand', asset.brand], ['Model', asset.model], ['Condition', asset.condition], ['Vendor / supplier', asset.vendor], ['Invoice', asset.invoice],
          ['Purchase date', asset.purchaseDate], ['Warranty ends', asset.warrantyEnd], ['Registered by', asset.createdBy], ['Registered at', asset.registeredAt]
        ].map(([label, value]) => <div key={label}><span>{label}</span><b>{display(value)}</b></div>)}
      </div>
      {currentAssignment && <div className="asset-item-custodian"><Package size={19} /><div><span>CURRENT CUSTODIAN</span><b>{display(currentAssignment.employeeName)}</b><small>{currentAssignment.employeeId ? `Employee ID ${currentAssignment.employeeId} · ` : ''}Assigned {display(currentAssignment.assignedDate)}</small></div></div>}
      {!!data.customSpecs?.length && <><h3>Additional identifiers</h3><div className="asset-item-grid">{data.customSpecs.map((spec, index) => <div key={`${spec.name}-${index}`}><span>{display(spec.name)}</span><b>{display(spec.value)}</b></div>)}</div></>}
      {!!data.documents?.length && <><h3>Photos and documents</h3><div className="asset-item-documents">{data.documents.map((document, index) => <a key={document.documentId || index} href={document.url} target="_blank" rel="noreferrer"><b>{display(document.fileName || document.type)}</b><span>{display(document.type)} · {display(document.date)}</span></a>)}</div></>}
      </section>
      <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>ITEM-SPECIFIC HISTORY</span><h2>What happened to this item</h2></div><span className="asset-item-history-count">{data.history?.length || 0} records</span></div>{data.history?.length ? <div className="asset-activity-timeline">{data.history.map((entry, index) => <article key={`${entry.historyId || entry.timestamp}-${index}`}><span className="asset-activity-marker" /><div className="asset-activity-card"><header><span>{String(entry.action || 'ASSET UPDATED').replaceAll('_', ' ')}</span><time>{formatPortalDateTime(entry.timestamp, String(entry.timestamp || 'Date unavailable'))}</time></header><b>{display(entry.assetId)} · {display(entry.branch)}</b>{(entry.oldValue || entry.newValue) && <p>{display(entry.oldValue)} <span>→</span> {display(entry.newValue)}</p>}{entry.remarks && <small>{entry.remarks}</small>}<small>Recorded by {display(entry.performedBy)}</small></div></article>)}</div> : <div className="asset-ops-empty"><ClockCounterClockwise size={23} /><b>No history recorded yet</b><span>New item actions will appear in this timeline.</span></div>}</section>
    </>}
  </main></Layout>;
}
