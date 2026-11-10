import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Barcode, CircleNotch, ClockCounterClockwise, Cube, FileText, MapPinLine, Package, WarningCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDate, formatPortalDateTime } from '../../utils/dateFormat';
import './AssetItemPage.css';

const display = value => value === null || value === undefined || value === '' ? '—' : String(value);
const EMPTY_LIST = Object.freeze([]);
const driveImageUrl = value => {
  const url = String(value || '');
  const id = url.match(/(?:file\/d\/|[?&]id=|\/d\/)([\w-]{20,})/)?.[1];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1200` : url;
};
const isImageDocument = document => /PHOTO|CONDITION|IMAGE/i.test(String(document.type || '')) || /\.(png|jpe?g|gif|webp|avif)(?:$|[?#])/i.test(`${document.fileName || ''} ${document.url || ''}`);
const isModelDocument = document => /3D|MODEL/i.test(String(document.type || '')) || /\.(glb|gltf|obj|stl|usdz)(?:$|[?#])/i.test(`${document.fileName || ''} ${document.url || ''}`);

function DetailGrid({ items }) {
  return <div className="asset-item-grid">{items.map(([label, value]) => <div key={label}><span>{label}</span><b>{display(value)}</b></div>)}</div>;
}

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
  const assignments = data?.assignments || EMPTY_LIST;
  const documents = data?.documents || EMPTY_LIST;
  const photos = useMemo(() => {
    const found = documents.filter(isImageDocument);
    if (asset.photoUrl && !found.some(document => document.url === asset.photoUrl)) found.unshift({ type: 'ASSET_PHOTO', fileName: 'Asset photo', url: asset.photoUrl });
    return found;
  }, [asset.photoUrl, documents]);
  const models = documents.filter(isModelDocument);
  const currentAssignment = assignments.find(record => ['ACTIVE', 'ASSIGNED'].includes(String(record.status || '').trim().toUpperCase()));

  return <Layout><main className="asset-ops-page asset-item-page">
    <Link className="asset-item-back" to="/assets/register"><ArrowLeft size={17} /> Back to asset register</Link>
    {error && <div className="asset-ops-message error" role="alert"><WarningCircle size={18} />{error}<button onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="asset-ops-panel asset-item-loading"><CircleNotch size={25} className="ph-spin" /> Loading item details…</div> : data && <>
      <header className="asset-ops-hero asset-item-hero"><span className="asset-ops-hero-icon"><Barcode size={23} weight="duotone" /></span><div><span className="asset-ops-eyebrow">IPCS ASSET IDENTIFICATION</span><h1>{display(asset.name)}</h1><p>{display(asset.assetId)} · {display(asset.category)}{asset.subcategory ? ` / ${asset.subcategory}` : ''}{asset.assetType ? ` / ${asset.assetType}` : ''}</p></div><span className={`asset-ops-status ${String(asset.status || 'available').toLowerCase()}`}>{String(asset.status || 'AVAILABLE').replaceAll('_', ' ')}</span></header>
      <section className="asset-item-location"><MapPinLine size={20} /><div><b>{display(asset.branch)}</b><span>{display(asset.location)}</span></div><span className="asset-item-location-condition">{display(asset.condition)} condition</span></section>

      <section className="asset-ops-panel asset-item-photo-panel"><div className="asset-ops-section-head"><div><span>VISUAL RECORD</span><h2>Item photos</h2></div><span className="asset-item-history-count">{photos.length} image{photos.length === 1 ? '' : 's'}</span></div>{photos.length ? <div className="asset-item-photo-grid">{photos.map((photo, index) => <a key={photo.documentId || `${photo.url}-${index}`} href={photo.url} target="_blank" rel="noreferrer"><img src={driveImageUrl(photo.url)} alt={photo.fileName || `${asset.name} asset photo ${index + 1}`} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} /><span>{display(photo.fileName || photo.type)} · {formatPortalDate(photo.date, String(photo.date || ''))}</span></a>)}</div> : <div className="asset-item-no-photo"><Cube size={27} /><div><b>No photo on file</b><span>Add an image to this asset’s document record to show it here. Attached 3D model files are listed below as links.</span></div></div>}</section>

      <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>ITEM RECORD</span><h2>Asset details</h2></div></div><DetailGrid items={[
        ['Asset ID', asset.assetId], ['Record type', asset.recordType], ['Category', asset.category], ['Subcategory', asset.subcategory], ['Item type', asset.assetType],
        ['Tracking mode', asset.trackingMode === 'QUANTITY' ? `Quantity group · ${asset.quantity} units` : 'Individual item'], ['Quantity', asset.quantity], ['Minimum stock', asset.minimumQuantity],
        ['Brand', asset.brand], ['Model', asset.model], ['Serial number', asset.serialNumber], ['Condition', asset.condition], ['Status', asset.status],
        ['Branch', asset.branch], ['Room / location', asset.location], ['Vendor / supplier', asset.vendor], ['Invoice number', asset.invoice],
        ['Purchase date', asset.purchaseDate ? formatPortalDate(asset.purchaseDate, String(asset.purchaseDate)) : ''], ['Purchase cost', asset.purchaseCost], ['Warranty ends', asset.warrantyEnd ? formatPortalDate(asset.warrantyEnd, String(asset.warrantyEnd)) : ''],
        ['Registered by', asset.createdBy], ['Registered at', asset.registeredAt ? formatPortalDateTime(asset.registeredAt, String(asset.registeredAt)) : ''], ['Last updated by', asset.updatedBy], ['Last updated', asset.updatedAt ? formatPortalDateTime(asset.updatedAt, String(asset.updatedAt)) : '']
      ]} />
      {asset.vendorDetails && <><h3>Supplier contact</h3><DetailGrid items={[
        ['Contact person', asset.vendorDetails.contactPerson], ['Phone', asset.vendorDetails.phone], ['Email', asset.vendorDetails.email], ['Address', asset.vendorDetails.address], ['GST number', asset.vendorDetails.gstNumber]
      ]} /></>}
      {currentAssignment && <div className="asset-item-custodian"><Package size={19} /><div><span>CURRENT CUSTODIAN</span><b>{display(currentAssignment.employeeName)}</b><small>{currentAssignment.employeeId ? `Employee ID ${currentAssignment.employeeId} · ` : ''}Assigned {formatPortalDateTime(currentAssignment.assignedDate, String(currentAssignment.assignedDate || ''))}</small></div></div>}
      {!!data.customSpecs?.length && <><h3>Additional identifiers</h3><DetailGrid items={data.customSpecs.map(spec => [display(spec.name), spec.value])} /></>}
      {!!models.length && <><h3>3D model files</h3><div className="asset-item-documents">{models.map((model, index) => <a key={model.documentId || index} href={model.url} target="_blank" rel="noreferrer"><b>{display(model.fileName || model.type)}</b><span>Open model file · {display(model.date)}</span></a>)}</div></>}
      {!!documents.length && <><h3>Documents</h3><div className="asset-item-documents">{documents.filter(document => !isImageDocument(document) && !isModelDocument(document)).map((document, index) => <a key={document.documentId || index} href={document.url} target="_blank" rel="noreferrer"><b><FileText size={14} /> {display(document.fileName || document.type)}</b><span>{display(document.type)} · {display(document.date)} · {display(document.uploadedBy)}</span></a>)}</div></>}
      </section>

      <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>ASSIGNMENT RECORD</span><h2>Custody history</h2></div><span className="asset-item-history-count">{assignments.length} records</span></div>{assignments.length ? <div className="asset-item-assignment-list">{assignments.map((record, index) => <article key={record.assignmentId || index}><header><b>{display(record.employeeName)}</b><span>{display(record.status)}</span></header><p>{record.employeeId ? `Employee ID ${record.employeeId} · ` : ''}{record.assignmentId || ''}</p><div><span>Assigned {formatPortalDateTime(record.assignedDate, String(record.assignedDate || ''))}</span><span>Returned {record.returnedDate ? formatPortalDateTime(record.returnedDate, String(record.returnedDate)) : '—'}</span></div><div><span>Issue condition: {display(record.conditionOnIssue)}</span><span>Return condition: {display(record.conditionOnReturn)}</span></div>{record.accessories && <small>Accessories: {record.accessories}</small>}{record.assignedBy && <small>Recorded by {record.assignedBy}</small>}{record.remarks && <small>{record.remarks}</small>}</article>)}</div> : <div className="asset-ops-empty compact">This asset has no assignment history.</div>}</section>

      {!!data.disposals?.length && <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>RETIREMENT RECORD</span><h2>Disposal history</h2></div></div><div className="asset-item-assignment-list">{data.disposals.map((entry, index) => <article key={entry.disposalId || index}><header><b>{display(entry.method)} · {display(entry.reason)}</b><span>{formatPortalDate(entry.date, String(entry.date || ''))}</span></header><p>{entry.disposalId || ''}</p><div><span>Requested by {display(entry.requestedBy)}</span><span>Approved by {display(entry.approvedBy)}</span></div>{entry.value && <small>Recovered value: {entry.value}</small>}{entry.remarks && <small>{entry.remarks}</small>}</article>)}</div></section>}

      {!!data.transfers?.length && <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>BRANCH MOVEMENT</span><h2>Transfer history</h2></div><span className="asset-item-history-count">{data.transfers.length} records</span></div><div className="asset-item-assignment-list">{data.transfers.map((entry, index) => <article key={entry.transferId || index}><header><b>{display(entry.fromBranch)} → {display(entry.toBranch)}</b><span>{display(entry.status)}</span></header><p>{entry.transferId || ''} · Requested {formatPortalDateTime(entry.requestedAt, String(entry.requestedAt || ''))}</p><div><span>Approved by {display(entry.approvedBy)}</span><span>Received by {display(entry.receivedBy)}</span></div><div><span>Approved {entry.approvedAt ? formatPortalDateTime(entry.approvedAt, String(entry.approvedAt)) : '—'}</span><span>Received {entry.receivedAt ? formatPortalDateTime(entry.receivedAt, String(entry.receivedAt)) : '—'}</span></div>{entry.rejectionReason && <small>Rejection reason: {entry.rejectionReason}</small>}{entry.remarks && <small>{entry.remarks}</small>}</article>)}</div></section>}

      {!!data.maintenance?.length && <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>SERVICE RECORD</span><h2>Maintenance history</h2></div><span className="asset-item-history-count">{data.maintenance.length} records</span></div><div className="asset-item-assignment-list">{data.maintenance.map((entry, index) => <article key={entry.maintenanceId || index}><header><b>{display(entry.issue)}</b><span>{display(entry.status)}</span></header><p>{entry.maintenanceId || ''} · Reported {formatPortalDateTime(entry.date, String(entry.date || ''))}</p><div><span>Reported by {display(entry.reportedBy)}</span><span>Previous status {display(entry.previousStatus)}</span></div><div><span>Service cost {display(entry.cost)}</span><span>Completed {entry.completedDate ? formatPortalDateTime(entry.completedDate, String(entry.completedDate)) : '—'}</span></div>{entry.remarks && <small>{entry.remarks}</small>}</article>)}</div></section>}

      <section className="asset-ops-panel"><div className="asset-ops-section-head"><div><span>ITEM-SPECIFIC HISTORY</span><h2>What happened to this item</h2></div><span className="asset-item-history-count">{data.history?.length || 0} records</span></div>{data.history?.length ? <div className="asset-activity-timeline">{data.history.map((entry, index) => <article key={`${entry.historyId || entry.timestamp}-${index}`}><span className="asset-activity-marker" /><div className="asset-activity-card"><header><span>{String(entry.action || 'ASSET UPDATED').replaceAll('_', ' ')}</span><time>{formatPortalDateTime(entry.timestamp, String(entry.timestamp || 'Date unavailable'))}</time></header><b>{display(entry.assetId)} · {display(entry.branch)}</b>{(entry.oldValue || entry.newValue) && <p>{display(entry.oldValue)} <span>→</span> {display(entry.newValue)}</p>}{entry.remarks && <small>{entry.remarks}</small>}<small>Recorded by {display(entry.performedBy)}</small></div></article>)}</div> : <div className="asset-ops-empty"><ClockCounterClockwise size={23} /><b>No history recorded yet</b><span>New item actions will appear in this timeline.</span></div>}</section>
    </>}
  </main></Layout>;
}
