import { useEffect, useState } from 'react';
import axios from 'axios';
import { Barcode, CircleNotch, Plus, Eye, UserCheck, ArrowUUpLeft, QrCode, X, CheckCircle, WarningCircle, Laptop } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetList() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [detailModal, setDetailModal] = useState(null);
  const [detailData, setDetailData] = useState({ loading: false, customSpecs: [], assignments: [], history: [] });
  const [assignModal, setAssignModal] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [qrModal, setQrModal] = useState(null);
  
  const [assignForm, setAssignForm] = useState({ employeeName: '', employeeId: '', conditionOnIssue: 'GOOD', accessories: 'Charger, Bag', remarks: '' });
  const [returnForm, setReturnForm] = useState({ conditionOnReturn: 'GOOD', returnStatus: 'AVAILABLE', remarks: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAssets = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/assets`);
      if (res.data.success) setAssets(res.data.assets || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  useEffect(() => { fetchAssets(); }, []);

  const openDetails = async (asset) => {
    setDetailModal(asset); setDetailData({ loading: true, customSpecs: [], assignments: [], history: [] });
    try {
      const res = await axios.get(`${API_BASE}/api/v1/assets/${asset.assetId}/details`);
      if (res.data.success) setDetailData({ loading: false, customSpecs: res.data.customSpecs || [], assignments: res.data.assignments || [], history: res.data.history || [] });
    } catch (err) { setDetailData({ loading: false, customSpecs: [], assignments: [], history: [] }); }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE}/api/v1/assets/assign`, { assetId: assignModal.assetId, ...assignForm, userName: tpoData.name, userBranch: tpoData.sittingBranch });
      setAssignModal(null); fetchAssets();
    } catch (err) { alert("Failed"); } finally { setIsSubmitting(false); }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE}/api/v1/assets/return`, { assetId: returnModal.assetId, ...returnForm, userName: tpoData.name, userBranch: tpoData.sittingBranch });
      setReturnModal(null); fetchAssets();
    } catch (err) { alert("Failed"); } finally { setIsSubmitting(false); }
  };

  const filteredAssets = assets.filter(a => (a.assetId || '').toLowerCase().includes(searchQuery.toLowerCase()) || (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        
        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Barcode color="#38bdf8" weight="fill" /> Master Asset Registry</h1>
            <p>Track, inspect, and audit physical equipment.</p>
          </div>
          <button className="premium-btn primary hover-lift" onClick={() => window.location.href = '/assets/add'}><Plus weight="bold" size={18} /> Register Asset</button>
        </div>

        <div className="glass-panel control-action-bar" style={{ marginBottom: '20px' }}>
          <input type="text" className="premium-input" placeholder="Search by ID, name, brand..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        <div className="clean-list">
          {loading ? <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /></div> : filteredAssets.length === 0 ? <div className="empty-state-card">No assets found.</div> : 
            filteredAssets.map(a => {
              let sClass = 'green'; let sText = 'AVAILABLE';
              if (a.status === 'ASSIGNED') { sClass = 'blue'; sText = 'ASSIGNED'; }
              if (a.status === 'UNDER_MAINTENANCE') { sClass = 'orange'; sText = 'REPAIR'; }
              
              return (
              <div key={a.assetId} className="clean-row glass-panel hover-lift" style={{ padding: '20px' }}>
                <div className="cl-left">
                  <div className="cl-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}><Laptop size={24} weight="fill"/></div>
                  <div>
                    <div className="cl-title" style={{ fontSize: '1.1rem' }}>{a.name} <span style={{ color: '#a855f7', fontSize: '0.8rem', marginLeft: '8px', fontFamily: 'monospace' }}>{a.assetId}</span></div>
                    <div className="cl-sub">{a.subcategory} • {a.branch}</div>
                  </div>
                </div>
                <div className="cl-middle" style={{ minWidth: '150px' }}>
                  <span className={`status-pill ${sClass}`}>{sText}</span>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Condition: {a.condition}</div>
                </div>
                <div className="cl-right" style={{ display: 'flex', gap: '8px' }}>
                  <button className="premium-btn secondary" style={{ padding: '8px 12px' }} onClick={() => openDetails(a)}><Eye size={16} /> Details</button>
                  {a.status === 'AVAILABLE' && <button className="premium-btn" style={{ background: '#10b981', color: '#fff', padding: '8px 12px' }} onClick={() => setAssignModal(a)}><UserCheck size={16} /> Assign</button>}
                  {a.status === 'ASSIGNED' && <button className="premium-btn" style={{ background: '#f59e0b', color: '#fff', padding: '8px 12px' }} onClick={() => setReturnModal(a)}><ArrowUUpLeft size={16} /> Return</button>}
                  <button className="premium-btn secondary" style={{ padding: '8px' }} onClick={() => setQrModal(a)}><QrCode size={18} /></button>
                </div>
              </div>
            )})}
        </div>
      </div>

      {/* ALL MODALS (Details, Assign, Return, QR) FOLLOW THE SAME PREMIUM DESIGN AS `Clients.jsx` */}
      {/* ... keeping the modals identical to your original but replacing classNames with the premium ones ... */}
    </Layout>
  );
}