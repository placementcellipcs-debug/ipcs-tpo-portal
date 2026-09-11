import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Wrench, X, CheckCircle, WarningCircle, DesktopTower, Screwdriver } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetMaintenance() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveForm, setResolveForm] = useState({ cost: '', remarks: '' });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchMaintenance = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/v1/assets/maintenance`);
      if (res.data.success) setMaintenance(res.data.maintenance || []);
    } catch (err) { 
      console.error("Error", err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchMaintenance(); 
  }, []);

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE}/api/v1/assets/maintenance/resolve`, { 
        maintenanceId: resolveModal.maintenanceId, 
        assetId: resolveModal.assetId, 
        cost: resolveForm.cost, 
        remarks: resolveForm.remarks 
      });
      showToast("Maintenance completed and asset restored!");
      setResolveModal(null); 
      setResolveForm({ cost: '', remarks: '' }); 
      fetchMaintenance();
    } catch (err) { 
      showToast("Failed to resolve maintenance ticket.", "error"); 
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {/* TOAST NOTIFICATION */}
        {notification && (
          <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 999999, backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444', color: '#ffffff', padding: '16px 24px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', fontWeight: 'bold' }}>
            {notification.type === 'success' ? <CheckCircle size={24} weight="fill" /> : <WarningCircle size={24} weight="fill" />}
            {notification.text}
          </div>
        )}

        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Screwdriver color="#f59e0b" weight="fill" /> Maintenance Lab
            </h1>
            <p>Track assets sent for repair, log corrective actions, and monitor repair costs.</p>
          </div>
        </div>

        {/* REPLACES OLD TABLE WITH PREMIUM TICKET CARDS */}
        <div className="clean-list">
          {loading ? (
            <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /><p>Fetching maintenance logs...</p></div>
          ) : maintenance.length === 0 ? (
            <div className="empty-state-card"><span style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block' }}>🛠️</span>No maintenance records found.</div>
          ) : (
            maintenance.map(m => (
              <div key={m.maintenanceId} className="clean-row glass-panel hover-lift" style={{ padding: '20px', borderLeft: m.status === 'OPEN' ? '4px solid #ef4444' : '4px solid #10b981' }}>
                
                <div className="cl-left" style={{ flex: 2, minWidth: '300px' }}>
                  <div className="cl-icon" style={{ background: m.status === 'OPEN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: m.status === 'OPEN' ? '#ef4444' : '#10b981' }}>
                    {m.status === 'OPEN' ? <Wrench size={24} weight="fill"/> : <CheckCircle size={24} weight="fill"/>}
                  </div>
                  <div>
                    <div className="cl-title" style={{ fontSize: '1.05rem', color: '#fff', whiteSpace: 'normal', lineHeight: '1.4' }}>{m.issue}</div>
                    <div className="cl-sub" style={{ marginTop: '4px' }}>
                      Ticket: <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{m.maintenanceId}</span> • Asset: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{m.assetId}</span>
                    </div>
                  </div>
                </div>
                
                <div className="cl-middle" style={{ flex: 1, minWidth: '150px' }}>
                  <span className={`status-pill ${m.status === 'OPEN' ? 'red' : 'green'}`}>{m.status}</span>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>Reported: <strong style={{ color: '#cbd5e1' }}>{m.date}</strong></div>
                </div>
                
                <div className="cl-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: '150px' }}>
                  {m.status === 'OPEN' ? (
                    <button className="premium-btn" onClick={() => setResolveModal(m)} style={{ background: '#10b981', color: '#fff', padding: '10px 16px' }}>
                      <CheckCircle size={18} weight="bold" /> Mark Resolved
                    </button>
                  ) : (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#10b981', fontSize: '1.2rem', fontWeight: '900' }}>₹{m.cost || '0'}</div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Repair Cost</div>
                    </div>
                  )}
                </div>

              </div>
            ))
          )}
        </div>
      </div>

      {/* RESOLVE MAINTENANCE MODAL */}
      {resolveModal && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setResolveModal(null); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div>
                <h2 style={{ color: '#10b981', margin: '0 0 5px 0' }}>Resolve Maintenance</h2>
                <div className="modal-subtitle" style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>{resolveModal.assetId} - Ticket {resolveModal.maintenanceId}</div>
              </div>
              <button className="close-btn" onClick={() => setResolveModal(null)}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleResolveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="data-label" style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>Total Repair Cost (₹) *</label>
                <input type="number" className="premium-input" style={{ width: '100%' }} value={resolveForm.cost} onChange={e => setResolveForm({...resolveForm, cost: e.target.value})} placeholder="e.g. 1500" required />
              </div>
              <div>
                <label className="data-label" style={{ display: 'block', marginBottom: '5px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>Corrective Action / Remarks *</label>
                <textarea className="premium-input" style={{ width: '100%', minHeight: '100px', resize: 'vertical' }} value={resolveForm.remarks} onChange={e => setResolveForm({...resolveForm, remarks: e.target.value})} placeholder="e.g. Replaced internal cooling fan and reapplied thermal paste." required />
              </div>
              
              <button type="submit" className="premium-btn" style={{ background: '#10b981', color: '#0f172a', marginTop: '10px', width: '100%', padding: '14px', fontSize: '1rem' }} disabled={isSubmitting}>
                {isSubmitting ? <CircleNotch size={24} className="ph-spin" /> : "Complete Repair & Restore Asset"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          🎨 PREMIUM CSS FOR MAINTENANCE PAGE
      --------------------------------------------------------- */}
      <style>{`
        .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
        
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); cursor: default; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.8); }

        .top-hero-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 20px; }
        .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
        .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }
        
        .premium-btn { border: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; cursor: pointer; }
        .premium-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .premium-input { background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 15px; font-size: 0.9rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .premium-input:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); }

        .empty-state-card { background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 50px 20px; text-align: center; color: #94a3b8; font-size: 1.1rem; font-weight: bold; }
        
        /* Clean List (Ticket Rows) */
        .clean-list { display: flex; flex-direction: column; gap: 15px; }
        .clean-row { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-radius: 16px; flex-wrap: wrap; gap: 15px; }
        
        .cl-left { display: flex; align-items: flex-start; gap: 20px; }
        .cl-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }
        .cl-title { font-weight: 700; margin-bottom: 3px; }
        .cl-sub { font-size: 0.8rem; color: #94a3b8; }
        
        .status-pill { padding: 6px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; width: max-content; }
        .status-pill.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-pill.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }

        /* Modals */
        .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .premium-modal { width: 100%; max-height: 90vh; overflow-y: auto; border-radius: 24px; padding: 30px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; }
        .close-btn { background: none; border: none; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; }
        .close-btn:hover { color: #ef4444; transform: scale(1.1); }
      `}</style>
    </Layout>
  );
}