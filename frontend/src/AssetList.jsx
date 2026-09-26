import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { 
  Barcode, CircleNotch, Plus, Eye, UserCheck, ArrowUUpLeft, 
  QrCode, X, CheckCircle, WarningCircle, Laptop, Wrench, Truck, Image, Trash, UploadSimple 
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetList() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const userRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  const myBranch = tpoData?.sittingBranch || '';
  
  const isSuperAdmin = accessType === 'superadmin' || userRole.includes('SYSTEM ADMIN') || userRole.includes('GENERAL MANAGER') || userRole.includes('ZONAL PLACEMENT HEAD') || userRole === 'TECHNICAL HEAD';
  const canManageAssets = isSuperAdmin || userRole.includes('ASSET');

  const [assets, setAssets] = useState([]);
  const [dbData, setDbData] = useState({ branches: [] });
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [detailModal, setDetailModal] = useState(null);
  const [detailData, setDetailData] = useState({ loading: false, customSpecs: [], assignments: [], history: [], documents: [] });
  const [activeDetailTab, setActiveDetailTab] = useState('specs'); // 'specs', 'history', 'documents', 'disposal'
  
  const [assignModal, setAssignModal] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [qrModal, setQrModal] = useState(null);
  const [maintenanceReqModal, setMaintenanceReqModal] = useState(null);
  const [transferReqModal, setTransferReqModal] = useState(null);

  const [assignForm, setAssignForm] = useState({ employeeName: '', employeeId: '', conditionOnIssue: 'GOOD', accessories: 'Charger, Bag', remarks: '' });
  const [returnForm, setReturnForm] = useState({ conditionOnReturn: 'GOOD', returnStatus: 'AVAILABLE', remarks: '' });
  const [maintenanceForm, setMaintenanceForm] = useState({ issue: '' });
  const [transferForm, setTransferForm] = useState({ toBranch: '', remarks: '' });
  
  const [uploadForm, setUploadForm] = useState({ file: null, type: 'PHOTO_BEFORE' });
  const [disposeForm, setDisposeForm] = useState({ reason: '', method: 'E-WASTE', value: '' });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchAssetsAndData = async () => {
    try {
      setLoading(true);
      const [assetRes, formRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/assets`),
        axios.get(`${API_BASE}/api/v1/assets/form-data`)
      ]);
      if (assetRes.data.success) setAssets(assetRes.data.assets || []);
      if (formRes.data.success) setDbData({ branches: formRes.data.branches || [] });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      axios.get(`${API_BASE}/api/v1/assets`),
      axios.get(`${API_BASE}/api/v1/assets/form-data`)
    ]).then(([assetRes, formRes]) => {
      if (!active) return;
      if (assetRes.data.success) setAssets(assetRes.data.assets || []);
      if (formRes.data.success) setDbData({ branches: formRes.data.branches || [] });
    }).catch(error => {
      if (active) showToast(error.response?.data?.message || 'Could not load the asset registry.', 'error');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const openDetails = async (asset) => {
    setDetailModal(asset);
    setActiveDetailTab('specs');
    setDetailData({ loading: true, customSpecs: [], assignments: [], history: [], documents: [] });
    try {
      const res = await axios.get(`${API_BASE}/api/v1/assets/${asset.assetId}/details`);
      if (res.data.success) {
        setDetailData({ loading: false, customSpecs: res.data.customSpecs || [], assignments: res.data.assignments || [], history: res.data.history || [], documents: res.data.documents || [] });
      }
    } catch { setDetailData({ loading: false, customSpecs: [], assignments: [], history: [], documents: [] }); showToast('Could not load asset details.', 'error'); }
  };

  // ================= ACTION SUBMISSIONS =================
  const handleAssignSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/assets/assign`, { assetId: assignModal.assetId, ...assignForm, userName: tpoData.name, userBranch: myBranch });
      if (res.data.success) { showToast(res.data.message); setAssignModal(null); fetchAssetsAndData(); }
    } catch (err) { showToast(err.response?.data?.message || 'Assignment failed.', 'error'); } finally { setIsSubmitting(false); }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/assets/return`, { assetId: returnModal.assetId, ...returnForm, userName: tpoData.name, userBranch: myBranch });
      if (res.data.success) { showToast(res.data.message); setReturnModal(null); fetchAssetsAndData(); }
    } catch (err) { showToast(err.response?.data?.message || 'Return failed.', 'error'); } finally { setIsSubmitting(false); }
  };

  const handleMaintenanceSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/assets/maintenance/report`, { assetId: maintenanceReqModal.assetId, issue: maintenanceForm.issue, userName: tpoData.name });
      if (res.data.success) { showToast("Ticket raised! Sent to Maintenance Lab."); setMaintenanceReqModal(null); setMaintenanceForm({ issue: '' }); fetchAssetsAndData(); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed to report maintenance.', 'error'); } finally { setIsSubmitting(false); }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/assets/transfers/request`, { assetId: transferReqModal.assetId, toBranch: transferForm.toBranch, remarks: transferForm.remarks, userName: tpoData.name, userBranch: myBranch });
      if (res.data.success) { showToast("Transfer requested!"); setTransferReqModal(null); setTransferForm({ toBranch: '', remarks: '' }); fetchAssetsAndData(); }
    } catch (err) { showToast(err.response?.data?.message || 'Failed to request transfer.', 'error'); } finally { setIsSubmitting(false); }
  };

  // 🚨 NEW: UPLOAD DOCUMENT / PHOTO
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) return showToast("Please select a file first.", "error");
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('assetId', detailModal.assetId);
    formData.append('documentType', uploadForm.type);
    formData.append('userName', tpoData.name);

    try {
      const res = await axios.post(`${API_BASE}/api/v1/assets/documents/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      if (res.data.success) {
        showToast("File uploaded successfully!");
        setUploadForm({ file: null, type: 'PHOTO_BEFORE' });
        if(fileInputRef.current) fileInputRef.current.value = '';
        openDetails(detailModal); // Refresh details
      }
    } catch { showToast("Upload failed.", "error"); } finally { setIsSubmitting(false); }
  };

  // 🚨 NEW: DISPOSE ASSET
  const handleDisposeSubmit = async (e) => {
    e.preventDefault();
    if (!window.confirm("WARNING: This will permanently retire this asset from the active registry. Continue?")) return;
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/assets/dispose`, { assetId: detailModal.assetId, ...disposeForm, userName: tpoData.name });
      if (res.data.success) {
        showToast("Asset successfully disposed.");
        setDetailModal(null);
        fetchAssetsAndData();
      }
    } catch { showToast("Disposal failed.", "error"); } finally { setIsSubmitting(false); }
  };

  const availableLocations = ['All', ...new Set(assets.map(a => a.location).filter(Boolean))];
  const uniqueCategories = ['All', ...new Set(assets.map(a => a.category).filter(Boolean))];

  const filteredAssets = assets.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchQ = (a.assetId || '').toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q) || (a.brand || '').toLowerCase().includes(q);
    const matchB = isSuperAdmin ? (branchFilter === 'All' || a.branch === branchFilter) : (a.branch === myBranch);
    const matchL = locationFilter === 'All' || a.location === locationFilter;
    const matchC = categoryFilter === 'All' || a.category === categoryFilter;
    const matchS = statusFilter === 'All' || a.status === statusFilter;
    return matchQ && matchB && matchL && matchC && matchS;
  });

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {notification && (
          <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 999999, backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444', color: '#ffffff', padding: '16px 24px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', fontWeight: 'bold' }}>
            {notification.type === 'success' ? <CheckCircle size={24} weight="fill" /> : <WarningCircle size={24} weight="fill" />}
            {notification.text}
          </div>
        )}

        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Barcode color="#8b5cf6" weight="fill" /> Master Asset Registry</h1>
            <p>Track, inspect, assign, and audit physical equipment across {isSuperAdmin ? 'all IPCS branches' : `the ${myBranch} branch`}.</p>
          </div>
          {canManageAssets && (
            <button className="premium-btn primary hover-lift" onClick={() => window.location.href = '/assets/add'}>
              <Plus weight="bold" size={18} /> Register Asset
            </button>
          )}
        </div>

        <div className="glass-panel control-action-bar">
          <div className="filter-group">
            <input type="text" className="premium-input" placeholder="Search by ID, name, brand, model..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {isSuperAdmin && (
              <select className="premium-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                <option value="All">All Branches</option>
                {dbData.branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            <select className="premium-select" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
              {availableLocations.map(l => <option key={l} value={l}>{l === 'All' ? 'All Labs & Locations' : l}</option>)}
            </select>
            <select className="premium-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              {uniqueCategories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
            </select>
            <select className="premium-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
              <option value="TRANSFER_PENDING">Transfer Pending</option>
              <option value="DISPOSED">Disposed</option>
            </select>
          </div>
        </div>

        <div className="clean-list">
          {loading ? (
            <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /><p>Fetching assets...</p></div>
          ) : filteredAssets.length === 0 ? (
            <div className="empty-state-card"><span style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block' }}>🔍</span>No assets found matching your criteria.</div>
          ) : (
            filteredAssets.map(a => {
              let sClass = 'green'; let sText = 'AVAILABLE';
              if (a.status === 'ASSIGNED') { sClass = 'blue'; sText = 'ASSIGNED'; }
              if (a.status === 'UNDER_MAINTENANCE') { sClass = 'red'; sText = 'REPAIR'; }
              if (a.status === 'TRANSFER_PENDING') { sClass = 'orange'; sText = 'IN TRANSIT'; }
              if (a.status === 'DISPOSED') { sClass = 'gray'; sText = 'DISPOSED'; }

              return (
                <div key={a.assetId} className="clean-row glass-panel hover-lift" style={{ opacity: a.status === 'DISPOSED' ? 0.6 : 1 }}>
                  
                  <div className="cl-left" style={{ flex: 2, minWidth: '350px' }}>
                    <div className="cl-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#8b5cf6' }}><Laptop size={24} weight="fill"/></div>
                    <div>
                      <div className="cl-title" style={{ fontSize: '1.1rem' }}>
                        {a.name} <span style={{ color: '#a855f7', fontSize: '0.85rem', marginLeft: '8px', fontFamily: 'monospace', background: 'rgba(168,85,247,0.1)', padding: '2px 8px', borderRadius: '6px' }}>{a.assetId}</span>
                      </div>
                      <div className="cl-sub">{a.subcategory} ({a.category}) • <b>{a.branch}</b> • {a.location || 'No Location'}</div>
                    </div>
                  </div>
                  
                  <div className="cl-middle" style={{ minWidth: '150px' }}>
                    <span className={`status-pill ${sClass}`}>{sText}</span>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>Condition: <strong style={{color: '#cbd5e1'}}>{a.condition}</strong></div>
                  </div>
                  
                  <div className="cl-right" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="premium-btn secondary" title="View Hub" onClick={() => openDetails(a)}><Eye size={18} /></button>
                    {a.status !== 'DISPOSED' && <button className="premium-btn secondary" title="Print QR" onClick={() => setQrModal(a)}><QrCode size={18} /></button>}
                    
                    {canManageAssets && a.status !== 'DISPOSED' && (
                      <>
                        {a.status === 'AVAILABLE' && <button className="premium-btn" style={{ background: '#10b981', color: '#fff' }} onClick={() => setAssignModal(a)}><UserCheck size={18} weight="bold" /> Assign</button>}
                        {a.status === 'ASSIGNED' && <button className="premium-btn" style={{ background: '#f59e0b', color: '#fff' }} onClick={() => setReturnModal(a)}><ArrowUUpLeft size={18} weight="bold" /> Return</button>}
                        {(a.status === 'AVAILABLE' || a.status === 'ASSIGNED') && (
                          <>
                            <button className="premium-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} title="Report Issue" onClick={() => setMaintenanceReqModal(a)}><Wrench size={18} weight="bold" /></button>
                            <button className="premium-btn" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }} title="Request Transfer" onClick={() => setTransferReqModal(a)}><Truck size={18} weight="bold" /></button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= MODALS SECTION ================= */}

      {/* 🚨 1. ASSET CONTROL HUB (SPECS, PHOTOS, DISPOSAL) */}
      {detailModal && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setDetailModal(null); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '850px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header */}
            <div style={{ padding: '25px', background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: '0 0 5px 0', fontSize: '1.6rem', color: '#fff' }}>{detailModal.name}</h2>
                  <div style={{ color: '#8b5cf6', fontFamily: 'monospace', fontWeight: 'bold' }}>{detailModal.assetId} • <span style={{ color: '#94a3b8', fontFamily: 'Inter' }}>{detailModal.branch}</span></div>
                </div>
                <button className="close-btn" onClick={() => setDetailModal(null)}><X size={24} /></button>
              </div>

              {/* TABS */}
              <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                <button className={`tab-btn ${activeDetailTab === 'specs' ? 'active' : ''}`} onClick={() => setActiveDetailTab('specs')}>Specs & History</button>
                <button className={`tab-btn ${activeDetailTab === 'assignments' ? 'active' : ''}`} onClick={() => setActiveDetailTab('assignments')}>Assignment Ledger</button>
                <button className={`tab-btn ${activeDetailTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveDetailTab('documents')}><Image size={16}/> Photos & Docs</button>
                {canManageAssets && detailModal.status !== 'DISPOSED' && (
                  <button className={`tab-btn text-red ${activeDetailTab === 'disposal' ? 'active-red' : ''}`} onClick={() => setActiveDetailTab('disposal')}><Trash size={16}/> Discard Asset</button>
                )}
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div style={{ padding: '25px', overflowY: 'auto', maxHeight: '60vh' }}>
              
              {/* TAB 1: SPECS & HISTORY */}
              {activeDetailTab === 'specs' && (
                <>
                  <h3 style={{ fontSize: '0.85rem', color: '#10b981', textTransform: 'uppercase', marginBottom: '15px' }}>Technical Specifications</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '30px' }}>
                    {detailData.loading ? ( <CircleNotch size={20} className="ph-spin" color="#8b5cf6"/> ) 
                    : detailData.customSpecs.length === 0 ? ( <span style={{ color: '#64748b', fontSize: '0.9rem' }}>No custom specs recorded.</span> ) 
                    : ( detailData.customSpecs.map((s, idx) => (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold' }}>{s.name}</div>
                          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem' }}>{s.value}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <h3 style={{ fontSize: '0.85rem', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '15px' }}>Audit Ledger History</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {detailData.loading ? ( <CircleNotch size={20} className="ph-spin" color="#f59e0b"/> ) 
                    : detailData.history.length === 0 ? ( <span style={{ color: '#64748b', fontSize: '0.9rem' }}>No audit history found.</span> ) 
                    : ( detailData.history.map((h, idx) => (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '4px' }}>{h.action.replace(/_/g, ' ')}</div>
                            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{h.remarks}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#8b5cf6', fontSize: '0.85rem', fontWeight: 'bold' }}>{h.performedBy}</div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>{h.timestamp}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {activeDetailTab === 'assignments' && (
                <>
                  <h3 style={{ fontSize: '0.85rem', color: '#10b981', textTransform: 'uppercase', marginBottom: '15px' }}>Custody &amp; Return Ledger</h3>
                  {detailData.loading ? <CircleNotch size={20} className="ph-spin" color="#10b981" /> : detailData.assignments.length === 0 ? (
                    <span style={{ color: '#64748b', fontSize: '0.9rem' }}>No assignment records found.</span>
                  ) : (
                    <div style={{ overflowX: 'auto' }}><table className="modern-table"><thead><tr><th>Custodian</th><th>Assignment</th><th>Issued</th><th>Returned</th><th>Condition</th><th>Status</th></tr></thead><tbody>
                      {detailData.assignments.map(item => <tr key={item.assignmentId}><td>{item.employeeName}</td><td>{item.assignmentId}</td><td>{item.assignedDate}</td><td>{item.returnedDate || '—'}</td><td>{item.conditionOnReturn || item.conditionOnIssue || '—'}</td><td>{item.status}</td></tr>)}
                    </tbody></table></div>
                  )}
                </>
              )}

              {/* TAB 2: DOCUMENTS & PHOTOS */}
              {activeDetailTab === 'documents' && (
                <>
                  {canManageAssets && (
                    <form onSubmit={handleUploadSubmit} style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px dashed #8b5cf6', padding: '20px', borderRadius: '12px', marginBottom: '25px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className="data-label">Document Type</label>
                        <select className="premium-select" style={{ width: '100%' }} value={uploadForm.type} onChange={e => setUploadForm({...uploadForm, type: e.target.value})}>
                          <option value="PHOTO_BEFORE">Before Image (Condition)</option>
                          <option value="PHOTO_AFTER">After Image (Repaired)</option>
                          <option value="INVOICE">Purchase Invoice</option>
                          <option value="WARRANTY">Warranty Card</option>
                          <option value="REPORT">Service Report</option>
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className="data-label">Select File</label>
                        <input type="file" ref={fileInputRef} className="premium-input" style={{ width: '100%', padding: '9px' }} onChange={e => setUploadForm({...uploadForm, file: e.target.files[0]})} required />
                      </div>
                      <button type="submit" className="premium-btn primary" style={{ height: '42px', marginTop: '22px' }} disabled={isSubmitting}>
                        {isSubmitting ? <CircleNotch size={20} className="ph-spin" /> : <><UploadSimple size={18} weight="bold"/> Upload</>}
                      </button>
                    </form>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                    {detailData.loading ? ( <CircleNotch size={20} className="ph-spin" color="#8b5cf6"/> ) 
                    : detailData.documents.length === 0 ? ( <span style={{ color: '#64748b', fontSize: '0.9rem' }}>No photos or documents uploaded yet.</span> ) 
                    : ( detailData.documents.map((doc, idx) => (
                        <a key={idx} href={doc.url} target="_blank" rel="noreferrer" style={{ display: 'block', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '15px', textDecoration: 'none', color: '#fff', transition: '0.2s' }} className="hover-lift">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <Image size={24} color="#8b5cf6" weight="duotone" />
                            <span style={{ fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 'bold' }}>{doc.type}</span>
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.fileName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{doc.date}</div>
                        </a>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* TAB 3: DISPOSAL */}
              {activeDetailTab === 'disposal' && canManageAssets && (
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', padding: '25px' }}>
                  <h3 style={{ color: '#ef4444', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><WarningCircle size={24} /> Danger Zone: Asset Disposal</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>Disposing an asset permanently removes it from available inventory. The audit history will be preserved.</p>
                  
                  <form onSubmit={handleDisposeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div>
                        <label className="data-label">Disposal Method *</label>
                        <select className="premium-select" style={{ width: '100%' }} value={disposeForm.method} onChange={e => setDisposeForm({...disposeForm, method: e.target.value})}>
                          <option value="E-WASTE">E-Waste / Recycled</option>
                          <option value="SOLD">Sold</option>
                          <option value="SCRAPPED">Scrapped / Destroyed</option>
                          <option value="LOST">Lost / Stolen</option>
                        </select>
                      </div>
                      <div>
                        <label className="data-label">Salvage Value (₹) (If Sold)</label>
                        <input type="number" className="premium-input" style={{ width: '100%' }} value={disposeForm.value} onChange={e => setDisposeForm({...disposeForm, value: e.target.value})} placeholder="e.g. 5000" disabled={disposeForm.method !== 'SOLD'} />
                      </div>
                    </div>
                    <div>
                      <label className="data-label">Reason / Remarks *</label>
                      <input type="text" className="premium-input" style={{ width: '100%' }} value={disposeForm.reason} onChange={e => setDisposeForm({...disposeForm, reason: e.target.value})} placeholder="e.g. Laptop motherboard dead, beyond repair." required />
                    </div>
                    <button type="submit" className="premium-btn" style={{ background: '#ef4444', color: '#fff', padding: '14px', marginTop: '10px' }} disabled={isSubmitting}>
                      {isSubmitting ? <CircleNotch size={24} className="ph-spin" /> : "Confirm Permanent Disposal"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. ASSIGN ASSET MODAL */}
      {assignModal && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setAssignModal(null); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div><h2 style={{ color: '#10b981', margin: 0 }}>Assign Asset</h2><div className="modal-subtitle" style={{ color: '#cbd5e1' }}>{assignModal.assetId} - {assignModal.name}</div></div>
              <button className="close-btn" onClick={() => setAssignModal(null)}><X size={24} /></button>
            </div>
            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div><label className="data-label">Employee Name *</label><input type="text" className="premium-input" style={{ width: '100%' }} value={assignForm.employeeName} onChange={e => setAssignForm({ ...assignForm, employeeName: e.target.value })} required /></div>
              <div><label className="data-label">Employee ID</label><input type="text" className="premium-input" style={{ width: '100%' }} value={assignForm.employeeId} onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })} /></div>
              <div><label className="data-label">Accessories Provided</label><input type="text" className="premium-input" style={{ width: '100%' }} value={assignForm.accessories} onChange={e => setAssignForm({ ...assignForm, accessories: e.target.value })} /></div>
              <div><label className="data-label">Remarks</label><input type="text" className="premium-input" style={{ width: '100%' }} value={assignForm.remarks} onChange={e => setAssignForm({ ...assignForm, remarks: e.target.value })} /></div>
              <button type="submit" className="premium-btn" style={{ background: '#10b981', color: '#0f172a', padding: '14px' }} disabled={isSubmitting}>{isSubmitting ? <CircleNotch className="ph-spin" /> : "Confirm Handover"}</button>
            </form>
          </div>
        </div>
      )}

      {/* 3. RETURN ASSET MODAL */}
      {returnModal && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setReturnModal(null); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div><h2 style={{ color: '#f59e0b', margin: 0 }}>Return Asset</h2><div className="modal-subtitle" style={{ color: '#cbd5e1' }}>{returnModal.assetId} - {returnModal.name}</div></div>
              <button className="close-btn" onClick={() => setReturnModal(null)}><X size={24} /></button>
            </div>
            <form onSubmit={handleReturnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div><label className="data-label">Condition On Return</label><select className="premium-select" style={{ width: '100%' }} value={returnForm.conditionOnReturn} onChange={e => setReturnForm({ ...returnForm, conditionOnReturn: e.target.value })}><option value="GOOD">Good</option><option value="FAIR">Fair</option><option value="DAMAGED">Damaged</option></select></div>
              <div><label className="data-label">Target Inventory Status</label><select className="premium-select" style={{ width: '100%' }} value={returnForm.returnStatus} onChange={e => setReturnForm({ ...returnForm, returnStatus: e.target.value })}><option value="AVAILABLE">Available</option><option value="UNDER_MAINTENANCE">Maintenance</option></select></div>
              <div><label className="data-label">Remarks</label><input type="text" className="premium-input" style={{ width: '100%' }} value={returnForm.remarks} onChange={e => setReturnForm({ ...returnForm, remarks: e.target.value })} /></div>
              <button type="submit" className="premium-btn" style={{ background: '#f59e0b', color: '#0f172a', padding: '14px' }} disabled={isSubmitting}>{isSubmitting ? <CircleNotch className="ph-spin" /> : "Confirm Return"}</button>
            </form>
          </div>
        </div>
      )}

      {maintenanceReqModal && (
        <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setMaintenanceReqModal(null); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '520px', padding: '26px' }}>
            <div className="modal-header"><div><h2 style={{ color: '#ef4444', margin: 0 }}>Report an Issue</h2><div className="modal-subtitle">{maintenanceReqModal.assetId} · {maintenanceReqModal.name}</div></div><button className="close-btn" onClick={() => setMaintenanceReqModal(null)}><X size={24} /></button></div>
            <form onSubmit={handleMaintenanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label className="data-label">Issue description *<textarea className="premium-input" style={{ width: '100%', minHeight: '100px', marginTop: '7px' }} value={maintenanceForm.issue} onChange={event => setMaintenanceForm({ issue: event.target.value })} placeholder="Describe the fault or service required" required /></label>
              <button type="submit" className="premium-btn" style={{ background: '#ef4444', color: '#fff', padding: '13px' }} disabled={isSubmitting}>{isSubmitting ? <CircleNotch size={18} className="ph-spin" /> : 'Create maintenance ticket'}</button>
            </form>
          </div>
        </div>
      )}

      {transferReqModal && (
        <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setTransferReqModal(null); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '520px', padding: '26px' }}>
            <div className="modal-header"><div><h2 style={{ color: '#a855f7', margin: 0 }}>Request Asset Transfer</h2><div className="modal-subtitle">{transferReqModal.assetId} · {transferReqModal.name}</div></div><button className="close-btn" onClick={() => setTransferReqModal(null)}><X size={24} /></button></div>
            <form onSubmit={handleTransferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label className="data-label">Destination branch *<select className="premium-select" style={{ width: '100%', marginTop: '7px' }} value={transferForm.toBranch} onChange={event => setTransferForm({ ...transferForm, toBranch: event.target.value })} required><option value="">Select destination</option>{dbData.branches.filter(branch => branch !== myBranch).map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></label>
              <label className="data-label">Transfer reason<textarea className="premium-input" style={{ width: '100%', minHeight: '75px', marginTop: '7px' }} value={transferForm.remarks} onChange={event => setTransferForm({ ...transferForm, remarks: event.target.value })} /></label>
              <button type="submit" className="premium-btn" style={{ background: '#a855f7', color: '#fff', padding: '13px' }} disabled={isSubmitting}>{isSubmitting ? <CircleNotch size={18} className="ph-spin" /> : 'Submit transfer request'}</button>
            </form>
          </div>
        </div>
      )}

      {qrModal && (
        <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setQrModal(null); }}>
          <div className="premium-modal glass-panel asset-print-card" style={{ maxWidth: '380px', padding: '28px', textAlign: 'center' }}>
            <button className="close-btn" style={{ marginLeft: 'auto' }} onClick={() => setQrModal(null)}><X size={22} /></button>
            <h2 style={{ margin: '0 0 4px', color: '#fff' }}>{qrModal.name}</h2>
            <div style={{ color: '#a855f7', fontFamily: 'monospace', fontWeight: 800 }}>{qrModal.assetId}</div>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrModal.assetId)}`} alt={`QR code for ${qrModal.assetId}`} style={{ display: 'block', width: 220, height: 220, margin: '18px auto', background: '#fff', padding: 8, borderRadius: 10 }} />
            <div style={{ color: '#94a3b8', fontSize: '.82rem', marginBottom: 16 }}>{qrModal.category} · {qrModal.branch}</div>
            <button type="button" className="premium-btn primary" style={{ margin: '0 auto' }} onClick={() => window.print()}>Print asset label</button>
          </div>
        </div>
      )}

      <style>{`
        .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); cursor: default; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.8); }

        .top-hero-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 20px; }
        .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
        .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }
        
        .premium-btn { border: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; cursor: pointer; }
        .premium-btn.primary { background: #3b82f6; color: #fff; }
        .premium-btn.secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        .premium-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .control-action-bar { border-radius: 16px; padding: 15px; margin-bottom: 30px; }
        .filter-group { display: flex; gap: 12px; flex-wrap: wrap; }
        .premium-input, .premium-select { background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 15px; font-size: 0.9rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .premium-input { flex: 1; min-width: 250px; }
        .premium-input:focus, .premium-select:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); }
        .premium-select option { background: #0f1523; color: #fff; padding: 10px; font-weight: bold; }
        .data-label { color: #94a3b8; font-size: 0.8rem; font-weight: bold; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

        .empty-state-card { background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 50px 20px; text-align: center; color: #94a3b8; font-size: 1.1rem; font-weight: bold; display: flex; flex-direction: column; align-items: center; }
        
        .clean-list { display: flex; flex-direction: column; gap: 15px; }
        .clean-row { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-radius: 16px; flex-wrap: wrap; gap: 15px; }
        .cl-left { display: flex; align-items: center; gap: 20px; }
        .cl-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cl-title { font-weight: 800; color: #fff; margin-bottom: 4px; display: flex; align-items: center; }
        .cl-sub { font-size: 0.85rem; color: #94a3b8; }
        
        .status-pill { padding: 6px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; width: max-content; }
        .status-pill.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-pill.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .status-pill.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .status-pill.orange { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .status-pill.gray { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }

        .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .premium-modal { width: 100%; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
        .close-btn { background: none; border: none; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; }
        .close-btn:hover { color: #ef4444; }

        .tab-btn { background: transparent; border: none; color: #94a3b8; font-weight: bold; font-size: 0.9rem; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.3s; }
        .tab-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }
        .tab-btn.active { background: #3b82f6; color: #fff; }
        .tab-btn.active-red { background: #ef4444; color: #fff; }
        .text-red:hover { color: #ef4444; }
        @media print { body * { visibility: hidden !important; } .asset-print-card, .asset-print-card * { visibility: visible !important; } .asset-print-card { position: fixed !important; inset: 10mm auto auto 10mm !important; width: 80mm !important; box-shadow: none !important; background: #fff !important; color: #111827 !important; } .asset-print-card h2, .asset-print-card div { color: #111827 !important; } .asset-print-card button { display: none !important; } }
      `}</style>
    </Layout>
  );
}
