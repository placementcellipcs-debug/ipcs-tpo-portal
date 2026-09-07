import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Barcode, CircleNotch, Plus, Eye, UserCheck, ArrowUUpLeft, 
  QrCode, X, CheckCircle, WarningCircle, Funnel, MagnifyingGlass
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetList() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const userRole = (tpoData?.role || '').toUpperCase();
  const isSuperAdmin = tpoData?.accessType === 'superadmin';

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals State
  const [detailModal, setDetailModal] = useState(null);
  const [detailData, setDetailData] = useState({ loading: false, customSpecs: [], assignments: [], history: [] });
  const [assignModal, setAssignModal] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [qrModal, setQrModal] = useState(null);

  // Forms State
  const [assignForm, setAssignForm] = useState({ employeeName: '', employeeId: '', conditionOnIssue: 'GOOD', accessories: 'Charger, Bag', remarks: '' });
  const [returnForm, setReturnForm] = useState({ conditionOnReturn: 'GOOD', returnStatus: 'AVAILABLE', remarks: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/v1/assets`);
      if (res.data.success) {
        setAssets(res.data.assets || []);
      }
    } catch (err) {
      console.error("Failed to load assets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const openDetails = async (asset) => {
    setDetailModal(asset);
    setDetailData({ loading: true, customSpecs: [], assignments: [], history: [] });
    try {
      const res = await axios.get(`${API_BASE}/api/v1/assets/${asset.assetId}/details`);
      if (res.data.success) {
        setDetailData({
          loading: false,
          customSpecs: res.data.customSpecs || [],
          assignments: res.data.assignments || [],
          history: res.data.history || []
        });
      }
    } catch (err) {
      setDetailData({ loading: false, customSpecs: [], assignments: [], history: [] });
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/assets/assign`, {
        assetId: assignModal.assetId,
        ...assignForm,
        userName: tpoData.name,
        userBranch: tpoData.sittingBranch
      });
      if (res.data.success) {
        setNotification({ type: 'success', text: res.data.message });
        setAssignModal(null);
        fetchAssets();
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.response?.data?.message || 'Assignment failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/assets/return`, {
        assetId: returnModal.assetId,
        ...returnForm,
        userName: tpoData.name,
        userBranch: tpoData.sittingBranch
      });
      if (res.data.success) {
        setNotification({ type: 'success', text: res.data.message });
        setReturnModal(null);
        fetchAssets();
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.response?.data?.message || 'Return failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter Logic
  const uniqueBranches = ['All', ...new Set(assets.map(a => a.branch).filter(Boolean))];
  const uniqueCategories = ['All', ...new Set(assets.map(a => a.category).filter(Boolean))];

  const filteredAssets = assets.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchQ = (a.assetId || '').toLowerCase().includes(q) ||
                   (a.name || '').toLowerCase().includes(q) ||
                   (a.brand || '').toLowerCase().includes(q) ||
                   (a.model || '').toLowerCase().includes(q);
    const matchB = branchFilter === 'All' || a.branch === branchFilter;
    const matchC = categoryFilter === 'All' || a.category === categoryFilter;
    const matchS = statusFilter === 'All' || a.status === statusFilter;
    return matchQ && matchB && matchC && matchS;
  });

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'AVAILABLE') return <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>AVAILABLE</span>;
    if (s === 'ASSIGNED') return <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #0284c7', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>ASSIGNED</span>;
    if (s === 'UNDER_MAINTENANCE') return <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>REPAIR</span>;
    return <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>{s}</span>;
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {notification && (
          <div style={{ marginBottom: '20px', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', fontWeight: 'bold', background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: notification.type === 'success' ? '#10b981' : '#ef4444', border: `1px solid ${notification.type === 'success' ? '#10b981' : '#ef4444'}` }}>
            {notification.type === 'success' ? <CheckCircle size={20} weight="fill"/> : <WarningCircle size={20} weight="fill"/>}
            {notification.text}
          </div>
        )}

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Barcode color="#38bdf8" weight="fill" /> Master Asset Registry
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Centrally track, inspect, assign, and audit physical equipment across all IPCS branches.</p>
          </div>
          <button 
            className="btn-action" 
            style={{ width: 'auto', background: '#38bdf8', color: '#0f172a', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold' }}
            onClick={() => window.location.href = '/assets/add'}
          >
            <Plus weight="bold" size={18} /> Register Asset
          </button>
        </div>

        {/* FILTERS */}
        <div className="header-controls" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center', background: 'var(--card-bg)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <input 
              type="text" 
              className="sleek-input" 
              style={{ width: '100%' }}
              placeholder="Search by ID, name, brand, model..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <select className="sleek-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
            {uniqueBranches.map(b => <option key={b} value={b}>{b === 'All' ? 'All Branches' : b}</option>)}
          </select>

          <select className="sleek-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            {uniqueCategories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
          </select>

          <select className="sleek-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
          </select>
        </div>

        {/* ASSET TABLE */}
        <div className="table-container">
          <table className="modern-table" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th>Asset Identity</th>
                <th>Category & Type</th>
                <th>Branch / Location</th>
                <th>Condition</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="#38bdf8" /></td></tr>
              ) : filteredAssets.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No assets registered yet.</td></tr>
              ) : (
                filteredAssets.map(a => (
                  <tr key={a.assetId}>
                    <td>
                      <span className="primary-text" style={{ color: '#38bdf8', fontFamily: 'monospace', fontWeight: 'bold' }}>{a.assetId}</span>
                      <span className="sub-text">{a.name} ({a.brand || 'No Brand'})</span>
                    </td>
                    <td>
                      <span className="primary-text">{a.subcategory}</span>
                      <span className="sub-text">{a.category}</span>
                    </td>
                    <td>
                      <span className="primary-text">{a.branch}</span>
                      <span className="sub-text">{a.location || 'Location N/A'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>{a.condition}</span>
                    </td>
                    <td>{getStatusBadge(a.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button onClick={() => openDetails(a)} style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid #0284c7', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                          <Eye size={16} /> Details
                        </button>
                        
                        {a.status === 'AVAILABLE' && (
                          <button onClick={() => setAssignModal(a)} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <UserCheck size={16} /> Assign
                          </button>
                        )}

                        {a.status === 'ASSIGNED' && (
                          <button onClick={() => setReturnModal(a)} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <ArrowUUpLeft size={16} /> Return
                          </button>
                        )}

                        <button onClick={() => setQrModal(a)} style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid var(--card-border)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                          <QrCode size={16} /> Tag
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 1. ASSET DETAILS & AUDIT HISTORY MODAL */}
        {detailModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="modal-card" style={{ maxWidth: '850px', width: '100%', maxHeight: '90vh', background: '#0f1523', border: '1px solid #38bdf8', borderRadius: '16px', padding: '2rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#fff' }}>{detailModal.name}</h2>
                  <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontWeight: 'bold' }}>{detailModal.assetId}</span> • <span style={{ color: 'var(--text-muted)' }}>{detailModal.branch}</span>
                </div>
                <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setDetailModal(null)} />
              </div>

              {/* TECHNICAL CUSTOM SPECIFICATIONS */}
              <h3 style={{ fontSize: '1rem', color: '#10b981', textTransform: 'uppercase', marginBottom: '10px' }}>Technical Specifications</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {detailData.customSpecs.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No custom specs recorded.</span> : detailData.customSpecs.map((s, idx) => (
                  <div key={idx} style={{ background: '#161e2e', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.name}</div>
                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* IMMUTABLE AUDIT LOG */}
              <h3 style={{ fontSize: '1rem', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '10px' }}>Audit Ledger History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {detailData.history.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No audit history found.</span> : detailData.history.map((h, idx) => (
                  <div key={idx} style={{ background: '#161e2e', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{h.action}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{h.remarks}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#38bdf8', fontSize: '0.8rem' }}>{h.performedBy}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{h.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. ASSIGN ASSET MODAL */}
        {assignModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid #10b981', borderRadius: '16px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#10b981' }}>Assign Asset</h2>
                <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setAssignModal(null)} />
              </div>

              <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label className="data-label">Employee Name *</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} value={assignForm.employeeName} onChange={e => setAssignForm({ ...assignForm, employeeName: e.target.value })} placeholder="e.g. Rahul Sharma" required />
                </div>
                <div>
                  <label className="data-label">Employee ID (Optional)</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} value={assignForm.employeeId} onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })} placeholder="e.g. EMP-042" />
                </div>
                <div>
                  <label className="data-label">Accessories Provided</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} value={assignForm.accessories} onChange={e => setAssignForm({ ...assignForm, accessories: e.target.value })} placeholder="e.g. Charger, Mouse, Bag" />
                </div>
                <div>
                  <label className="data-label">Handover Remarks</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} value={assignForm.remarks} onChange={e => setAssignForm({ ...assignForm, remarks: e.target.value })} placeholder="Issued for official center training" />
                </div>
                <button type="submit" className="btn-action" style={{ background: '#10b981', color: '#0f172a', marginTop: '10px' }} disabled={isSubmitting}>
                  {isSubmitting ? <CircleNotch size={20} className="ph-spin" /> : "Confirm Handover & Log"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 3. RETURN ASSET MODAL */}
        {returnModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid #f59e0b', borderRadius: '16px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#f59e0b' }}>Return Asset to Store</h2>
                <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setReturnModal(null)} />
              </div>

              <form onSubmit={handleReturnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label className="data-label">Condition On Return</label>
                  <select className="sleek-select" style={{ width: '100%' }} value={returnForm.conditionOnReturn} onChange={e => setReturnForm({ ...returnForm, conditionOnReturn: e.target.value })}>
                    <option value="GOOD">Good / Intact</option>
                    <option value="FAIR">Fair (Minor Scratches)</option>
                    <option value="DAMAGED">Damaged / Defective</option>
                  </select>
                </div>
                <div>
                  <label className="data-label">Target Inventory Status</label>
                  <select className="sleek-select" style={{ width: '100%' }} value={returnForm.returnStatus} onChange={e => setReturnForm({ ...returnForm, returnStatus: e.target.value })}>
                    <option value="AVAILABLE">Available for Re-Issue</option>
                    <option value="UNDER_MAINTENANCE">Send for Repair / Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="data-label">Verification Notes</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} value={returnForm.remarks} onChange={e => setReturnForm({ ...returnForm, remarks: e.target.value })} placeholder="All accessories returned safely" />
                </div>
                <button type="submit" className="btn-action" style={{ background: '#f59e0b', color: '#0f172a', marginTop: '10px' }} disabled={isSubmitting}>
                  {isSubmitting ? <CircleNotch size={20} className="ph-spin" /> : "Confirm Return & Update Registry"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 4. PRINTABLE QR TAG PREVIEW */}
        {qrModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="modal-card" style={{ maxWidth: '380px', width: '100%', background: '#ffffff', borderRadius: '16px', padding: '2rem', textAlign: 'center', color: '#000' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', fontWeight: 900 }}>IPCS GLOBAL</h3>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', display: 'block', marginBottom: '15px' }}>Asset Tracking Tag</span>
              
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrModal.assetId)}`} 
                alt="QR Code" 
                style={{ width: '180px', height: '180px', margin: '0 auto 15px auto', display: 'block', border: '1px solid #e2e8f0', padding: '6px' }}
              />

              <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.2rem', marginBottom: '4px' }}>{qrModal.assetId}</div>
              <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>{qrModal.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{qrModal.branch}</div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Print Tag</button>
                <button onClick={() => setQrModal(null)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}