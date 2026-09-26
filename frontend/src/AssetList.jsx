import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Barcode, Buildings, Camera, CheckCircle, CircleNotch, ClockCounterClockwise, Cube, Image as ImageIcon, MagnifyingGlass, MapPinLine, QrCode, UserCheck, Wrench, X } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';
import './AssetManagement.css';

const readUser = () => {
  try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { return {}; }
};
const clean = value => String(value || '').trim().toLowerCase();
const fileImage = value => {
  if (!value) return '';
  const match = String(value).match(/(?:file\/d\/|[?&]id=|\/d\/)([\w-]{20,})/);
  return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w900` : value;
};
const statusLabel = status => ({ AVAILABLE: 'Available', ASSIGNED: 'Assigned', UNDER_MAINTENANCE: 'Maintenance', TRANSFER_PENDING: 'In transit', DISPOSED: 'Retired' }[status] || status || 'Available');

function PhotoField({ label, value, onChange, required = false }) {
  return (
    <label className="asset-photo-field">
      <Camera size={18} />
      <span><b>{value ? value.name : label}</b><small>{required ? 'Photo required' : 'Photo optional · JPG or PNG'}</small></span>
      <input type="file" accept="image/*" capture="environment" required={required} onChange={event => onChange(event.target.files?.[0] || null)} />
    </label>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="asset-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="asset-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="asset-modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" aria-label="Close" onClick={onClose}><X size={20} /></button></header>
        {children}
      </section>
    </div>
  );
}

export default function AssetList() {
  const user = useMemo(() => readUser(), []);
  const role = String(user.role || '').toUpperCase();
  const isGlobalAdmin = String(user.accessType || '').toLowerCase() === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
  const canManage = isGlobalAdmin || role.includes('ASSET');
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [dbData, setDbData] = useState({ branches: [], locations: [] });
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(isGlobalAdmin ? '' : (user.sittingBranch || ''));
  const selectedBranchRef = useRef(isGlobalAdmin ? '' : (user.sittingBranch || ''));
  const [selectedSpace, setSelectedSpace] = useState('');
  const [search, setSearch] = useState('');
  const [assetView, setAssetView] = useState('branches');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [detailData, setDetailData] = useState({ loading: false, customSpecs: [], assignments: [], history: [], documents: [] });
  const [assignItem, setAssignItem] = useState(null);
  const [returnItem, setReturnItem] = useState(null);
  const [disposeItem, setDisposeItem] = useState(null);
  const [qrItem, setQrItem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [assignForm, setAssignForm] = useState({ employeeName: '', employeeId: '', conditionOnIssue: 'GOOD', accessories: '', remarks: '', photo: null });
  const [returnForm, setReturnForm] = useState({ conditionOnReturn: 'GOOD', returnStatus: 'AVAILABLE', remarks: '', photo: null });
  const [disposalForm, setDisposalForm] = useState({ reason: '', method: 'Recycling', value: '', remarks: '' });

  const loadData = useCallback(async () => {
    try {
      const [assetRes, formRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/assets`),
        axios.get(`${API_BASE}/api/v1/assets/form-data`)
      ]);
      const nextAssets = assetRes.data?.assets || [];
      const form = formRes.data || {};
      const branchNames = [...new Set([...(form.branches || []), ...nextAssets.map(item => item.branch).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
      setAssets(nextAssets);
      setDbData({ branches: branchNames, locations: form.locations || [] });
      if (!isGlobalAdmin && !selectedBranchRef.current) {
        const defaultBranch = user.sittingBranch || branchNames[0] || '';
        selectedBranchRef.current = defaultBranch;
        setSelectedBranch(defaultBranch);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not load asset records.');
    } finally { setLoading(false); }
  }, [isGlobalAdmin, user.sittingBranch]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);
  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const branchAssets = useMemo(() => assets.filter(asset => clean(asset.branch) === clean(selectedBranch)), [assets, selectedBranch]);
  const spaces = useMemo(() => {
    const names = new Set(branchAssets.map(asset => asset.location?.trim() || 'Unassigned space'));
    dbData.locations.forEach(location => {
      const name = location.locationname || location.name || location.location || '';
      const branch = location.branch || location.branchname || '';
      if (name && (!branch || clean(branch) === clean(selectedBranch))) names.add(name);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [branchAssets, dbData.locations, selectedBranch]);

  const matchesSearch = item => {
    const query = clean(search);
    return !query || [item.assetId, item.name, item.brand, item.model, item.category, item.subcategory, item.branch, item.location, item.vendor].some(value => clean(value).includes(query));
  };
  const spaceAssets = branchAssets.filter(asset => (asset.location?.trim() || 'Unassigned space') === selectedSpace && matchesSearch(asset));
  const registryAssets = assets.filter(asset => matchesSearch(asset) && (assetView === 'retired' ? asset.status === 'DISPOSED' : asset.status !== 'DISPOSED')).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  const selectedBranchStats = {
    total: branchAssets.length,
    assigned: branchAssets.filter(item => item.status === 'ASSIGNED').length,
    available: branchAssets.filter(item => item.status === 'AVAILABLE').length
  };
  const showToast = text => { setMessage(text); };

  const openDetails = async item => {
    setDetails(item);
    setDetailTab('overview');
    setDetailData({ loading: true, asset: {}, customSpecs: [], assignments: [], history: [], documents: [], disposals: [] });
    try {
      const response = await axios.get(`${API_BASE}/api/v1/assets/${encodeURIComponent(item.assetId)}/details`);
      setDetailData({ loading: false, ...response.data, asset: response.data.asset || {}, customSpecs: response.data.customSpecs || [], assignments: response.data.assignments || [], history: response.data.history || [], documents: response.data.documents || [], disposals: response.data.disposals || [] });
    } catch (error) {
      setDetailData({ loading: false, asset: {}, customSpecs: [], assignments: [], history: [], documents: [], disposals: [] });
      showToast(error.response?.data?.message || 'Could not load item details.');
    }
  };

  const submitHandover = async event => {
    event.preventDefault();
    setBusy(true);
    const data = new FormData();
    Object.entries(assignForm).forEach(([key, value]) => { if (key !== 'photo') data.append(key, value); });
    data.append('assetId', assignItem.assetId);
    data.append('userName', user.name || '');
    if (assignForm.photo) data.append('photo', assignForm.photo);
    try {
      const response = await axios.post(`${API_BASE}/api/v1/assets/assign`, data);
      setAssignItem(null);
      setAssignForm({ employeeName: '', employeeId: '', conditionOnIssue: 'GOOD', accessories: '', remarks: '', photo: null });
      showToast(response.data.message || 'Asset assigned.');
      await loadData();
    } catch (error) { showToast(error.response?.data?.message || 'Could not assign the asset.'); }
    finally { setBusy(false); }
  };

  const submitReturn = async event => {
    event.preventDefault();
    setBusy(true);
    const data = new FormData();
    Object.entries(returnForm).forEach(([key, value]) => { if (key !== 'photo') data.append(key, value); });
    data.append('assetId', returnItem.assetId);
    data.append('userName', user.name || '');
    if (returnForm.photo) data.append('photo', returnForm.photo);
    try {
      const response = await axios.post(`${API_BASE}/api/v1/assets/return`, data);
      setReturnItem(null);
      setReturnForm({ conditionOnReturn: 'GOOD', returnStatus: 'AVAILABLE', remarks: '', photo: null });
      showToast(response.data.message || 'Asset return recorded.');
      await loadData();
    } catch (error) { showToast(error.response?.data?.message || 'Could not record the return.'); }
    finally { setBusy(false); }
  };

  const submitDisposal = async event => {
    event.preventDefault();
    if (!disposeItem || !window.confirm(`Permanently dispose ${disposeItem.assetId}? This action cannot be undone.`)) return;
    setBusy(true);
    try {
      const response = await axios.post(`${API_BASE}/api/v1/assets/dispose`, {
        assetId: disposeItem.assetId,
        reason: disposalForm.reason,
        method: disposalForm.method,
        value: disposalForm.value || 0,
        remarks: disposalForm.remarks,
        userName: user.name || ''
      });
      if (!response.data?.success) throw new Error(response.data?.message || 'Could not dispose of the asset.');
      setAssets(current => current.map(item => item.assetId === disposeItem.assetId ? { ...item, status: 'DISPOSED' } : item));
      setDetails(current => current?.assetId === disposeItem.assetId ? { ...current, status: 'DISPOSED' } : current);
      setDetailData(current => ({
        ...current,
        disposals: [{ disposalId: response.data.disposalId, reason: disposalForm.reason, method: disposalForm.method, value: disposalForm.value || '0', date: response.data.disposedDate, remarks: disposalForm.remarks }, ...current.disposals],
        history: [{ action: 'ASSET_DISPOSED', performedBy: user.name || '', timestamp: response.data.disposedDate, remarks: `${disposalForm.reason} · ${disposalForm.method}` }, ...current.history]
      }));
      setDisposeItem(null);
      setDisposalForm({ reason: '', method: 'Recycling', value: '', remarks: '' });
      showToast(response.data.message || 'Asset marked as disposed.');
    } catch (error) { showToast(error.response?.data?.message || error.message || 'Could not dispose of the asset.'); }
    finally { setBusy(false); }
  };

  const openBranch = branch => { selectedBranchRef.current = branch; setSelectedBranch(branch); setSelectedSpace(''); setSearch(''); };
  const itemPhoto = item => fileImage(item.photoUrl);

  return (
    <Layout>
      <main className="asset-workspace">
        {message && <div className="asset-toast" role="status">{message}<button type="button" onClick={() => setMessage('')} aria-label="Dismiss"><X size={16} /></button></div>}
        <section className="asset-overview-hero">
          <div className="asset-overview-icon"><Barcode size={25} weight="duotone" /></div>
          <div className="asset-overview-copy"><span>IPCS · OPERATIONS</span><h1>Asset management</h1><p>Browse each branch, open an office space, and inspect the equipment assigned there.</p></div>
          {canManage && <button type="button" className="asset-action-primary" onClick={() => navigate('/assets/add')}>Register an item <ArrowRight size={17} /></button>}
        </section>

        <section className="asset-summary-strip" aria-label="Asset summary">
          <div><span>Tracked items</span><strong>{assets.length}</strong></div>
          <div><span>Branches</span><strong>{dbData.branches.length}</strong></div>
          <div><span>Assigned</span><strong>{assets.filter(item => item.status === 'ASSIGNED').length}</strong></div>
          <div><span>Available</span><strong>{assets.filter(item => item.status === 'AVAILABLE').length}</strong></div>
        </section>

        <details className="asset-howto"><summary>How asset tracking works</summary><div><span><b>1 · Register</b> Add an item with its branch, office space, vendor, purchase details, photo, and auto-generated ID/QR.</span><span><b>2 · Assign</b> Record the employee, issued condition, accessories, and a handover photo.</span><span><b>3 · Return</b> Record the new condition and return photo; items needing repair move to maintenance.</span><span><b>4 · Track or dispose</b> Open any item for its audit timeline, assignments, photos, vendor and warranty data. Retire available items with a reason and disposal method.</span></div></details>

        <nav className="asset-primary-tabs" aria-label="Asset views">
          <button type="button" className={assetView === 'branches' ? 'active' : ''} onClick={() => { setAssetView('branches'); setSearch(''); }}><Buildings size={17} /> Branches &amp; spaces</button>
          <button type="button" className={assetView === 'register' ? 'active' : ''} onClick={() => { setAssetView('register'); setSearch(''); }}><Barcode size={17} /> Item register <span>{assets.filter(item => item.status !== 'DISPOSED').length}</span></button>
          <button type="button" className={assetView === 'retired' ? 'active' : ''} onClick={() => { setAssetView('retired'); setSearch(''); }}><ClockCounterClockwise size={17} /> Retired <span>{assets.filter(item => item.status === 'DISPOSED').length}</span></button>
        </nav>

        <div className="asset-toolbar">
          {assetView === 'branches' ? <div className="asset-breadcrumbs" aria-label="Asset location">
            <button type="button" onClick={() => { selectedBranchRef.current = ''; setSelectedBranch(''); setSelectedSpace(''); }}>Branches</button>
            {selectedBranch && <><span>/</span><button type="button" onClick={() => setSelectedSpace('')}>{selectedBranch}</button></>}
            {selectedSpace && <><span>/</span><strong>{selectedSpace}</strong></>}
          </div> : <div className="asset-registry-intro"><b>{assetView === 'retired' ? 'Retired asset records' : 'All registered items'}</b><span>Search by asset code, name, branch, room, or vendor.</span></div>}
          {(selectedSpace && assetView === 'branches' || assetView !== 'branches') && <label className="asset-search"><MagnifyingGlass size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={assetView === 'branches' ? 'Search this space' : 'Search asset register'} /></label>}
        </div>

        {loading ? (
          <div className="asset-state-card"><CircleNotch size={28} className="ph-spin" /><p>Loading branch inventory…</p></div>
        ) : assetView !== 'branches' ? (
          <section className="asset-register-panel" aria-label={assetView === 'retired' ? 'Retired assets' : 'Asset register'}>
            {registryAssets.length ? <div className="asset-register-scroll"><table className="asset-register-table"><thead><tr><th>Asset</th><th>Branch &amp; space</th><th>Vendor</th><th>Condition</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>
              {registryAssets.map(item => <tr key={item.assetId}>
                <td><button type="button" className="asset-register-item" onClick={() => openDetails(item)}><b>{item.name}</b><span>{item.assetId}</span></button></td>
                <td><b>{item.branch || '—'}</b><span>{item.location || 'Unassigned space'}</span></td>
                <td>{item.vendor || '—'}</td>
                <td>{item.condition || 'GOOD'}</td>
                <td><span className={`asset-status status-${String(item.status || 'AVAILABLE').toLowerCase()}`}>{statusLabel(item.status)}</span></td>
                <td><button type="button" className="asset-register-open" onClick={() => openDetails(item)}>View details <ArrowRight size={15} /></button></td>
              </tr>)}
            </tbody></table></div> : <div className="asset-state-card">{assetView === 'retired' ? 'No retired items match this search.' : 'No items match this search.'}</div>}
          </section>
        ) : !selectedBranch ? (
          <section className="asset-branch-grid" aria-label="Branches">
            {dbData.branches.map(branch => {
              const list = assets.filter(item => clean(item.branch) === clean(branch));
              const roomCount = new Set(list.map(item => item.location?.trim() || 'Unassigned space')).size;
              return (
                <button className="asset-branch-card" type="button" key={branch} onClick={() => openBranch(branch)}>
                  <span className="asset-card-kicker">BRANCH INVENTORY</span><span className="asset-branch-glyph"><Buildings size={23} weight="duotone" /></span>
                  <h2>{branch}</h2><p>{roomCount} office spaces · {list.length} items</p>
                  <span className="asset-card-foot">Open branch <ArrowRight size={16} /></span>
                </button>
              );
            })}
            {!dbData.branches.length && <div className="asset-state-card">No branches are assigned to this account.</div>}
          </section>
        ) : !selectedSpace ? (
          <>
            <div className="asset-step-heading"><div><span>BRANCH</span><h2>{selectedBranch}</h2><p>Choose an office space to see its inventory.</p></div><div className="asset-branch-counts"><span><b>{selectedBranchStats.total}</b> Items</span><span><b>{selectedBranchStats.assigned}</b> Assigned</span><span><b>{selectedBranchStats.available}</b> Available</span></div></div>
            <section className="asset-space-grid" aria-label={`${selectedBranch} office spaces`}>
              {spaces.map(space => {
                const list = branchAssets.filter(item => (item.location?.trim() || 'Unassigned space') === space);
                return (
                  <button className="asset-space-card" type="button" key={space} onClick={() => setSelectedSpace(space)}>
                    <span className="asset-space-glyph"><MapPinLine size={24} weight="duotone" /></span><div className="asset-space-title"><span>OFFICE SPACE</span><h3>{space}</h3></div>
                    <div className="asset-space-metrics"><span><b>{list.length}</b> total items</span><span><b>{list.filter(item => item.status === 'ASSIGNED').length}</b> assigned</span></div>
                    <span className="asset-space-open">View items <ArrowRight size={16} /></span>
                  </button>
                );
              })}
              {!spaces.length && <div className="asset-state-card">No office spaces have been registered for this branch yet.</div>}
            </section>
          </>
        ) : (
          <>
            <div className="asset-step-heading"><div><span>OFFICE SPACE</span><h2>{selectedSpace}</h2><p>{selectedBranch} · {spaceAssets.length} matching items</p></div><button type="button" className="asset-back-button" onClick={() => setSelectedSpace('')}><ArrowLeft size={16} /> All spaces</button></div>
            <section className="asset-item-grid" aria-label="Office space assets">
              {spaceAssets.map(item => (
                <article className="asset-item-card" key={item.assetId}>
                  <button className="asset-item-photo" type="button" onClick={() => openDetails(item)} aria-label={`Open ${item.name} details`}>
                    {itemPhoto(item) ? <img src={itemPhoto(item)} alt={item.name} loading="lazy" /> : <span><Cube size={38} weight="duotone" /></span>}
                    <b className={`asset-status status-${String(item.status || 'AVAILABLE').toLowerCase()}`}>{statusLabel(item.status)}</b>
                  </button>
                  <div className="asset-item-info"><div className="asset-item-code">{item.assetId}</div><h3>{item.name}</h3><p>{[item.brand, item.model].filter(Boolean).join(' · ') || item.subcategory || item.category}</p><div className="asset-condition"><span>Condition</span><b>{item.condition || 'GOOD'}</b></div></div>
                  <div className="asset-item-actions">
                    <button type="button" className="asset-icon-button" title="Item history and photos" onClick={() => openDetails(item)}><ImageIcon size={17} /></button>
                    <button type="button" className="asset-icon-button" title="Print asset QR" onClick={() => setQrItem(item)}><QrCode size={17} /></button>
                    {canManage && item.status === 'AVAILABLE' && <button type="button" className="asset-small-action" onClick={() => setAssignItem(item)}><UserCheck size={16} /> Assign</button>}
                    {canManage && item.status === 'ASSIGNED' && <button type="button" className="asset-small-action return-action" onClick={() => setReturnItem(item)}><ArrowLeft size={16} /> Return</button>}
                    {item.status === 'UNDER_MAINTENANCE' && <span className="asset-maintenance-tag"><Wrench size={14} /> Service</span>}
                  </div>
                </article>
              ))}
              {!spaceAssets.length && <div className="asset-state-card">No items match this space and search.</div>}
            </section>
          </>
        )}

        {details && (
          <Modal title={details.name} subtitle={`${details.assetId} · ${details.branch} · ${details.location || 'Unassigned space'}`} onClose={() => setDetails(null)}>
            <div className="asset-detail-body">
              <nav className="asset-detail-tabs" aria-label="Asset details">
                <button type="button" className={detailTab === 'overview' ? 'active' : ''} onClick={() => setDetailTab('overview')}><Cube size={16} /> Overview</button>
                <button type="button" className={detailTab === 'history' ? 'active' : ''} onClick={() => setDetailTab('history')}><ClockCounterClockwise size={16} /> History &amp; disposal</button>
              </nav>
              {detailTab === 'overview' && <>
              <div className="asset-detail-overview"><div><span>Current condition</span><b>{details.condition || 'GOOD'}</b></div><div><span>Status</span><b>{statusLabel(details.status)}</b></div><div><span>Category</span><b>{details.category || '—'}</b></div><div><span>Model</span><b>{[details.brand, details.model].filter(Boolean).join(' ') || '—'}</b></div></div>
              <h3>Purchase &amp; vendor</h3>
              <div className="asset-spec-grid asset-vendor-grid">
                <div><span>Vendor</span><b>{detailData.asset.vendorDetails?.name || detailData.asset.vendor || details.vendor || 'Not recorded'}</b></div>
                <div><span>Contact person</span><b>{detailData.asset.vendorDetails?.contactPerson || '—'}</b></div>
                <div><span>Phone</span><b>{detailData.asset.vendorDetails?.phone || '—'}</b></div>
                <div><span>Email</span><b>{detailData.asset.vendorDetails?.email || '—'}</b></div>
                <div><span>Address</span><b>{detailData.asset.vendorDetails?.address || '—'}</b></div>
                <div><span>GST number</span><b>{detailData.asset.vendorDetails?.gstNumber || '—'}</b></div>
                <div><span>Invoice</span><b>{detailData.asset.invoice || details.invoice || '—'}</b></div>
                <div><span>Purchased</span><b>{detailData.asset.purchaseDate || details.purchaseDate || '—'}</b></div>
                <div><span>Warranty through</span><b>{detailData.asset.warrantyEnd || details.warrantyEnd || '—'}</b></div>
                {detailData.asset.purchaseCost !== '' && detailData.asset.purchaseCost !== undefined && <div><span>Purchase cost</span><b>{detailData.asset.purchaseCost}</b></div>}
              </div>
              <h3>Condition photos</h3>
              {(() => {
                const registered = detailData.documents.find(doc => doc.type === 'PHOTO_REGISTERED') || detailData.documents.find(doc => doc.type === 'PHOTO_BEFORE');
                const issue = detailData.documents.find(doc => doc.type === 'PHOTO_ISSUE');
                const returned = detailData.documents.find(doc => doc.type === 'PHOTO_RETURN');
                const previous = issue || registered;
                const latestPhoto = detailData.documents.find(doc => String(doc.type || '').startsWith('PHOTO'));
                const current = returned || latestPhoto;
                return <div className="asset-condition-photos">{[
                  { title: issue ? 'At handover' : 'At registration', photo: previous, condition: detailData.assignments[0]?.conditionOnIssue || 'Initial condition' },
                  { title: returned ? 'Latest return' : 'Latest photo', photo: current, condition: detailData.assignments[0]?.conditionOnReturn || details.condition || 'Current condition' }
                ].map((entry, index) => <div className="asset-condition-photo" key={`${entry.title}-${index}`}>{entry.photo?.url ? <a href={entry.photo.url} target="_blank" rel="noreferrer"><img src={fileImage(entry.photo.url)} alt={entry.title} /></a> : <span className="asset-no-photo"><Camera size={22} />No photo yet</span>}<div><b>{entry.title}</b><span>{entry.condition}</span><small>{entry.photo?.date || ''}</small></div></div>)}</div>;
              })()}
              <h3>Specifications</h3>
              {detailData.loading ? <span className="asset-detail-loading"><CircleNotch size={18} className="ph-spin" /> Loading record…</span> : detailData.customSpecs.length ? <div className="asset-spec-grid">{detailData.customSpecs.map((spec, index) => <div key={`${spec.name}-${index}`}><span>{spec.name}</span><b>{spec.value || '—'}</b></div>)}</div> : <p className="asset-detail-empty">No additional technical specifications.</p>}
              <h3>Current custodian</h3>
              {detailData.loading ? <span className="asset-detail-loading"><CircleNotch size={18} className="ph-spin" /> Loading record…</span> : (detailData.assignments.find(assignment => String(assignment.status || '').toUpperCase() === 'ASSIGNED') || (details.status === 'ASSIGNED' ? detailData.assignments[0] : null)) ? (() => { const assigned = detailData.assignments.find(assignment => String(assignment.status || '').toUpperCase() === 'ASSIGNED') || detailData.assignments[0]; return <div className="asset-current-holder"><b>{assigned.employeeName || 'Assigned user'}</b><span>{assigned.employeeId || 'Employee ID not recorded'} · Issued {assigned.assignedDate || 'date not recorded'}</span></div>; })() : <p className="asset-detail-empty">This item is currently not assigned to a person.</p>}
              </>}
              {detailTab === 'history' && <>
              <h3>Complete item history</h3>
              {detailData.loading ? <span className="asset-detail-loading"><CircleNotch size={18} className="ph-spin" /> Loading record…</span> : detailData.history.length ? <div className="asset-history-list">{detailData.history.map((entry, index) => <article key={`${entry.timestamp}-${index}`}><span className="asset-history-dot" /><div><div className="asset-history-title"><b>{String(entry.action || 'Updated').replaceAll('_', ' ')}</b><time>{entry.timestamp || 'Date not recorded'}</time></div>{(entry.oldValue || entry.newValue) && <p>{entry.oldValue || '—'} <ArrowRight size={14} /> {entry.newValue || '—'}</p>}{entry.remarks && <small>{entry.remarks}</small>}<small>By {entry.performedBy || 'System'}</small></div></article>)}</div> : <p className="asset-detail-empty">No audit events recorded for this item.</p>}
              <h3>Assignment history</h3>
              {detailData.loading ? <span className="asset-detail-loading"><CircleNotch size={18} className="ph-spin" /> Loading record…</span> : detailData.assignments.length ? <div className="asset-assignment-list">{detailData.assignments.map(assignment => <article key={assignment.assignmentId}><div><b>{assignment.employeeName || 'Unassigned'}</b><span>{assignment.assignmentId} · {assignment.status || '—'}{assignment.employeeId ? ` · ${assignment.employeeId}` : ''}</span>{assignment.accessories && <span>Accessories: {assignment.accessories}</span>}{assignment.remarks && <span>{assignment.remarks}</span>}</div><div><span>Issued {assignment.conditionOnIssue || '—'} · {assignment.assignedDate || '—'}</span><span>Returned {assignment.conditionOnReturn || 'Pending'} · {assignment.returnedDate || '—'}</span></div></article>)}</div> : <p className="asset-detail-empty">No assignment history.</p>}
              {detailData.disposals.length > 0 && <><h3>Disposal record</h3><div className="asset-disposal-records">{detailData.disposals.map(entry => <article key={entry.disposalId}><b>{entry.disposalId} · {entry.method}</b><span>{entry.date} · {entry.reason}</span>{entry.value && <span>Recovered value: {entry.value}</span>}{entry.remarks && <small>{entry.remarks}</small>}</article>)}</div></>}
              </>}
              {canManage && details.status === 'AVAILABLE' && <div className="asset-detail-actions"><button type="button" className="asset-dispose-button" onClick={() => { setDisposalForm({ reason: '', method: 'Recycling', value: '', remarks: '' }); setDisposeItem(details); }}>Dispose of this asset</button></div>}
            </div>
          </Modal>
        )}

        {assignItem && <Modal title="Assign this item" subtitle={`${assignItem.name} · ${assignItem.assetId}`} onClose={() => setAssignItem(null)}><form className="asset-form" onSubmit={submitHandover}><label>Employee name<input value={assignForm.employeeName} onChange={event => setAssignForm({ ...assignForm, employeeName: event.target.value })} required /></label><label>Employee ID<input value={assignForm.employeeId} onChange={event => setAssignForm({ ...assignForm, employeeId: event.target.value })} /></label><label>Condition at handover<select value={assignForm.conditionOnIssue} onChange={event => setAssignForm({ ...assignForm, conditionOnIssue: event.target.value })}><option>NEW</option><option>EXCELLENT</option><option>GOOD</option><option>FAIR</option><option>DAMAGED</option></select></label><label>Accessories<input value={assignForm.accessories} onChange={event => setAssignForm({ ...assignForm, accessories: event.target.value })} placeholder="Charger, bag…" /></label><label>Notes<input value={assignForm.remarks} onChange={event => setAssignForm({ ...assignForm, remarks: event.target.value })} /></label><PhotoField label="Add handover photo" value={assignForm.photo} onChange={photo => setAssignForm({ ...assignForm, photo })} /><button className="asset-action-primary form-submit" type="submit" disabled={busy}>{busy ? <CircleNotch size={18} className="ph-spin" /> : <UserCheck size={18} />} Confirm handover</button></form></Modal>}

        {returnItem && <Modal title="Return this item" subtitle={`${returnItem.name} · ${returnItem.assetId}`} onClose={() => setReturnItem(null)}><form className="asset-form" onSubmit={submitReturn}><label>Condition on return<select value={returnForm.conditionOnReturn} onChange={event => setReturnForm({ ...returnForm, conditionOnReturn: event.target.value, returnStatus: event.target.value === 'DAMAGED' ? 'UNDER_MAINTENANCE' : returnForm.returnStatus })}><option>NEW</option><option>EXCELLENT</option><option>GOOD</option><option>FAIR</option><option>DAMAGED</option></select></label><label>Next status<select value={returnForm.returnStatus} onChange={event => setReturnForm({ ...returnForm, returnStatus: event.target.value })}><option value="AVAILABLE">Available</option><option value="UNDER_MAINTENANCE">Maintenance</option></select></label><label>Return notes<input value={returnForm.remarks} onChange={event => setReturnForm({ ...returnForm, remarks: event.target.value })} placeholder="Note visible damage or missing parts" /></label><PhotoField label="Add current return photo" value={returnForm.photo} onChange={photo => setReturnForm({ ...returnForm, photo })} /><button className="asset-action-primary form-submit" type="submit" disabled={busy}>{busy ? <CircleNotch size={18} className="ph-spin" /> : <CheckCircle size={18} />} Record return</button></form></Modal>}

        {disposeItem && <Modal title="Dispose of asset" subtitle={`${disposeItem.name} · ${disposeItem.assetId}`} onClose={() => setDisposeItem(null)}><form className="asset-form" onSubmit={submitDisposal}><div className="asset-permanent-note">This permanently retires the item and records who approved the disposal.</div><label>Reason for disposal<input value={disposalForm.reason} onChange={event => setDisposalForm({ ...disposalForm, reason: event.target.value })} placeholder="End of useful life, damaged beyond repair…" required /></label><label>Disposal method<select value={disposalForm.method} onChange={event => setDisposalForm({ ...disposalForm, method: event.target.value })}><option>Recycling</option><option>Sale</option><option>Donation</option><option>Secure destruction</option><option>Other</option></select></label><label>Recovery value<input type="number" min="0" step="0.01" value={disposalForm.value} onChange={event => setDisposalForm({ ...disposalForm, value: event.target.value })} placeholder="0" /></label><label>Disposal notes<textarea rows="3" value={disposalForm.remarks} onChange={event => setDisposalForm({ ...disposalForm, remarks: event.target.value })} placeholder="Add a reference number or handover details" /></label><button className="asset-dispose-button form-submit" type="submit" disabled={busy}>{busy ? <CircleNotch size={18} className="ph-spin" /> : 'Confirm permanent disposal'}</button></form></Modal>}

        {qrItem && <Modal title="Asset label" subtitle={qrItem.assetId} onClose={() => setQrItem(null)}><div className="asset-qr-card"><h3>{qrItem.name}</h3><img src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrItem.assetId)}`} alt={`QR code for ${qrItem.assetId}`} /><p>{qrItem.branch} · {qrItem.location || 'Unassigned space'}</p><button type="button" className="asset-action-primary" onClick={() => window.print()}>Print label</button></div></Modal>}
      </main>
    </Layout>
  );
}
