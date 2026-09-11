import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Barcode, CircleNotch, Plus, Eye, UserCheck, ArrowUUpLeft, 
  QrCode, X, CheckCircle, WarningCircle, Laptop 
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetList() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const userRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  
  // Only Admins and Asset Managers can assign/return/register assets
  const isSuperAdmin = accessType === 'superadmin' || userRole.includes('ADMIN') || userRole.includes('HEAD');
  const canManageAssets = isSuperAdmin || userRole.includes('ASSET');

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
      setTimeout(() => setNotification(null), 4000);
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
      setTimeout(() => setNotification(null), 4000);
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

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {notification && (
          <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 999999, backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444', color: '#ffffff', padding: '16px 24px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', fontWeight: 'bold' }}>
            {notification.type === 'success' ? <CheckCircle size={24} weight="fill" /> : <WarningCircle size={24} weight="fill" />}
            {notification.text}
          </div>
        )}

        {/* HERO SECTION */}
        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Barcode color="#38bdf8" weight="fill" /> Master Asset Registry</h1>
            <p>Track, inspect, assign, and audit physical equipment across all IPCS branches.</p>
          </div>
          {canManageAssets && (
            <button className="premium-btn primary hover-lift" onClick={() => window.location.href = '/assets/add'}>
              <Plus weight="bold" size={18} /> Register Asset
            </button>
          )}
        </div>

        {/* FILTERS ACTION BAR */}
        <div className="glass-panel control-action-bar">
          <div className="filter-group">
            <input 
              type="text" 
              className="premium-input" 
              placeholder="Search by ID, name, brand, model..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select className="premium-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              {uniqueBranches.map(b => <option key={b} value={b}>{b === 'All' ? 'All Branches' : b}</option>)}
            </select>
            <select className="premium-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              {uniqueCategories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
            </select>
            <select className="premium-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
            </select>
          </div>
        </div>

        {/* ASSET LIST (Replaces the old HTML table) */}
        <div className="clean-list">
          {loading ? (
            <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /><p>Fetching assets...</p></div>
          ) : filteredAssets.length === 0 ? (
            <div className="empty-state-card"><span style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block' }}>🔍</span>No assets found matching your criteria.</div>
          ) : (
            filteredAssets.map(a => {
              let sClass = 'green'; let sText = 'AVAILABLE';
              if (a.status === 'ASSIGNED') { sClass = 'blue'; sText = 'ASSIGNED'; }
              if (a.status === 'UNDER_MAINTENANCE') { sClass = 'orange'; sText = 'REPAIR'; }

              return (
                <div key={a.assetId} className="clean-row glass-panel hover-lift">
                  
                  <div className="cl-left">
                    <div className="cl-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}><Laptop size={24} weight="fill"/></div>
                    <div>
                      <div className="cl-title" style={{ fontSize: '1.1rem' }}>
                        {a.name} <span style={{ color: '#a855f7', fontSize: '0.85rem', marginLeft: '8px', fontFamily: 'monospace', background: 'rgba(168,85,247,0.1)', padding: '2px 8px', borderRadius: '6px' }}>{a.assetId}</span>
                      </div>
                      <div className="cl-sub">{a.subcategory} ({a.category}) • {a.branch}</div>
                    </div>
                  </div>
                  
                  <div className="cl-middle" style={{ minWidth: '180px' }}>
                    <span className={`status-pill ${sClass}`}>{sText}</span>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>Condition: <strong style={{color: '#cbd5e1'}}>{a.condition}</strong></div>
                  </div>
                  
                  <div className="cl-right" style={{ display: 'flex', gap: '10px' }}>
                    <button className="premium-btn secondary" onClick={() => openDetails(a)}>
                      <Eye size={18} /> Details
                    </button>
                    
                    {canManageAssets && (
                      <>
                        {a.status === 'AVAILABLE' && (
                          <button className="premium-btn" style={{ background: '#10b981', color: '#fff' }} onClick={() => setAssignModal(a)}>
                            <UserCheck size={18} weight="bold" /> Assign
                          </button>
                        )}
                        {a.status === 'ASSIGNED' && (
                          <button className="premium-btn" style={{ background: '#f59e0b', color: '#fff' }} onClick={() => setReturnModal(a)}>
                            <ArrowUUpLeft size={18} weight="bold" /> Return
                          </button>
                        )}
                      </>
                    )}

                    <button className="premium-btn secondary" title="Print Tag" onClick={() => setQrModal(a)}>
                      <QrCode size={18} />
                    </button>
                  </div>
                  
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* 1. ASSET DETAILS & AUDIT HISTORY MODAL */}
      {detailModal && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setDetailModal(null); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <div>
                <h2>{detailModal.name}</h2>
                <div className="modal-subtitle">
                  <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{detailModal.assetId}</span> • <span style={{ color: '#94a3b8' }}>{detailModal.branch}</span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setDetailModal(null)}><X size={24} /></button>
            </div>

            {/* TECHNICAL CUSTOM SPECIFICATIONS */}
            <h3 style={{ fontSize: '0.9rem', color: '#10b981', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '0.5px' }}>Technical Specifications</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '30px' }}>
              {detailData.loading ? (
                <div style={{ color: '#38bdf8', display: 'flex', gap: '10px' }}><CircleNotch size={20} className="ph-spin"/> Loading specs...</div>
              ) : detailData.customSpecs.length === 0 ? (
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>No custom specs recorded.</span>
              ) : (
                detailData.customSpecs.map((s, idx) => (
                  <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold' }}>{s.name}</div>
                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem' }}>{s.value}</div>
                  </div>
                ))
              )}
            </div>

            {/* IMMUTABLE AUDIT LOG */}
            <h3 style={{ fontSize: '0.9rem', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '0.5px' }}>Audit Ledger History</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {detailData.loading ? (
                <div style={{ color: '#f59e0b', display: 'flex', gap: '10px' }}><CircleNotch size={20} className="ph-spin"/> Loading history...</div>
              ) : detailData.history.length === 0 ? (
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>No audit history found.</span>
              ) : (
                detailData.history.map((h, idx) => (
                  <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '4px' }}>{h.action.replace(/_/g, ' ')}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{h.remarks}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 'bold' }}>{h.performedBy}</div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>{h.timestamp}</div>
                    </div>
                  </div>
                ))
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
              <div>
                <h2 style={{ color: '#10b981' }}>Assign Asset</h2>
                <div className="modal-subtitle" style={{ color: '#cbd5e1' }}>{assignModal.assetId} - {assignModal.name}</div>
              </div>
              <button className="close-btn" onClick={() => setAssignModal(null)}><X size={24} /></button>
            </div>

            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="data-label" style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>Employee Name *</label>
                <input type="text" className="premium-input" style={{ width: '100%' }} value={assignForm.employeeName} onChange={e => setAssignForm({ ...assignForm, employeeName: e.target.value })} placeholder="e.g. Rahul Sharma" required />
              </div>
              <div>
                <label className="data-label" style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>Employee ID (Optional)</label>
                <input type="text" className="premium-input" style={{ width: '100%' }} value={assignForm.employeeId} onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })} placeholder="e.g. EMP-042" />
              </div>
              <div>
                <label className="data-label" style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>Accessories Provided</label>
                <input type="text" className="premium-input" style={{ width: '100%' }} value={assignForm.accessories} onChange={e => setAssignForm({ ...assignForm, accessories: e.target.value })} placeholder="e.g. Charger, Mouse, Bag" />
              </div>
              <div>
                <label className="data-label" style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>Handover Remarks</label>
                <input type="text" className="premium-input" style={{ width: '100%' }} value={assignForm.remarks} onChange={e => setAssignForm({ ...assignForm, remarks: e.target.value })} placeholder="Issued for official center training" />
              </div>
              
              <button type="submit" className="premium-btn" style={{ background: '#10b981', color: '#0f172a', marginTop: '10px', width: '100%', padding: '14px', fontSize: '1rem' }} disabled={isSubmitting}>
                {isSubmitting ? <CircleNotch size={24} className="ph-spin" /> : "Confirm Handover & Log"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. RETURN ASSET MODAL */}
      {returnModal && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setReturnModal(null); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div>
                <h2 style={{ color: '#f59e0b' }}>Return Asset to Store</h2>
                <div className="modal-subtitle" style={{ color: '#cbd5e1' }}>{returnModal.assetId} - {returnModal.name}</div>
              </div>
              <button className="close-btn" onClick={() => setReturnModal(null)}><X size={24} /></button>
            </div>

            <form onSubmit={handleReturnSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="data-label" style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>Condition On Return</label>
                <select className="premium-select" style={{ width: '100%', padding: '12px 15px' }} value={returnForm.conditionOnReturn} onChange={e => setReturnForm({ ...returnForm, conditionOnReturn: e.target.value })}>
                  <option value="GOOD">Condition: Good / Intact</option>
                  <option value="FAIR">Condition: Fair (Minor Scratches)</option>
                  <option value="DAMAGED">Condition: Damaged / Defective</option>
                </select>
              </div>
              <div>
                <label className="data-label" style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>Target Inventory Status</label>
                <select className="premium-select" style={{ width: '100%', padding: '12px 15px' }} value={returnForm.returnStatus} onChange={e => setReturnForm({ ...returnForm, returnStatus: e.target.value })}>
                  <option value="AVAILABLE">Status: Available for Re-Issue</option>
                  <option value="UNDER_MAINTENANCE">Status: Send for Repair / Maintenance</option>
                </select>
              </div>
              <div>
                <label className="data-label" style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>Verification Notes</label>
                <input type="text" className="premium-input" style={{ width: '100%' }} value={returnForm.remarks} onChange={e => setReturnForm({ ...returnForm, remarks: e.target.value })} placeholder="All accessories returned safely" />
              </div>
              
              <button type="submit" className="premium-btn" style={{ background: '#f59e0b', color: '#0f172a', marginTop: '10px', width: '100%', padding: '14px', fontSize: '1rem' }} disabled={isSubmitting}>
                {isSubmitting ? <CircleNotch size={24} className="ph-spin" /> : "Confirm Return & Update Registry"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. PRINTABLE QR TAG PREVIEW */}
      {qrModal && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setQrModal(null); }}>
          <div style={{ maxWidth: '380px', width: '100%', background: '#ffffff', borderRadius: '16px', padding: '2rem', textAlign: 'center', color: '#000', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>IPCS GLOBAL</h3>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', display: 'block', marginBottom: '20px', fontWeight: 'bold' }}>Asset Tracking Tag</span>
            
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrModal.assetId)}`} 
              alt="QR Code" 
              style={{ width: '180px', height: '180px', margin: '0 auto 20px auto', display: 'block', border: '2px solid #e2e8f0', padding: '10px', borderRadius: '12px' }}
            />

            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.3rem', marginBottom: '6px', color: '#0f172a' }}>{qrModal.assetId}</div>
            <div style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 'bold', marginBottom: '4px' }}>{qrModal.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{qrModal.branch}</div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}>Print Tag</button>
              <button onClick={() => setQrModal(null)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          🎨 PREMIUM CSS FOR ASSET REGISTRY
      --------------------------------------------------------- */}
      <style>{`
        .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
        
        /* Glass Panels */
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); cursor: default; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.8); }

        /* Hero */
        .top-hero-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 20px; }
        .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
        .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }
        
        .premium-btn { border: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; cursor: pointer; }
        .premium-btn.primary { background: #3b82f6; color: #fff; }
        .premium-btn.secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        .premium-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Action Bar */
        .control-action-bar { border-radius: 16px; padding: 15px; margin-bottom: 30px; }
        .filter-group { display: flex; gap: 12px; flex-wrap: wrap; }
        .premium-input, .premium-select { background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 15px; font-size: 0.9rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .premium-input { flex: 1; min-width: 250px; }
        .premium-input:focus, .premium-select:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); }
        .premium-select option { background: #0f1523; color: #fff; padding: 10px; font-weight: bold; }

        /* Empty State */
        .empty-state-card { background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 50px 20px; text-align: center; color: #94a3b8; font-size: 1.1rem; font-weight: bold; display: flex; flex-direction: column; align-items: center; }
        .text-blue { color: #3b82f6; }

        /* Clean List (Asset Rows) */
        .clean-list { display: flex; flex-direction: column; gap: 15px; }
        .clean-row { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-radius: 16px; flex-wrap: wrap; gap: 15px; }
        
        .cl-left { display: flex; align-items: center; gap: 20px; flex: 2; min-width: 300px; }
        .cl-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cl-title { font-size: 1.15rem; font-weight: 800; color: #fff; margin-bottom: 4px; display: flex; align-items: center; }
        .cl-sub { font-size: 0.85rem; color: #94a3b8; font-weight: 500; }
        
        .cl-middle { display: flex; flex-direction: column; justify-content: center; flex: 1; min-width: 150px; }
        
        .cl-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }

        /* Status Pills */
        .status-pill { padding: 6px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; width: max-content; }
        .status-pill.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-pill.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .status-pill.orange { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .status-pill.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }

        /* Modals */
        .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .premium-modal { width: 100%; max-height: 90vh; overflow-y: auto; border-radius: 24px; padding: 30px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .modal-header h2 { margin: 0 0 5px 0; font-size: 1.6rem; color: #fff; font-weight: 800; }
        .modal-subtitle { color: #38bdf8; font-weight: bold; font-size: 1rem; }
        .close-btn { background: none; border: none; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; }
        .close-btn:hover { color: #ef4444; transform: scale(1.1); }
      `}</style>
    </Layout>
  );
}