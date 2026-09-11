import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, ArrowsLeftRight, CheckCircle, WarningCircle, Truck } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetTransfers() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : {};
  const upperRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  
  // Only Super Admins should approve transfers
  const isSuperAdmin = accessType === 'superadmin' || upperRole.includes('ADMIN') || upperRole.includes('HEAD');

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/v1/assets/transfers`);
      if (res.data.success) {
        setTransfers(res.data.transfers || []);
      }
    } catch (err) {
      console.error("Error loading transfers", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleApprove = async (transfer) => {
    if (!window.confirm(`Are you sure you want to approve the transfer of Asset ${transfer.assetId} to ${transfer.toBranch}?`)) return;
    
    setApprovingId(transfer.transferId);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/assets/transfers/approve`, { 
        transferId: transfer.transferId, 
        assetId: transfer.assetId, 
        toBranch: transfer.toBranch, 
        userName: tpoData.name 
      });
      if(res.data.success) {
        showToast("Transfer approved and asset location updated!");
        fetchTransfers();
      }
    } catch (err) {
      showToast("Failed to approve transfer.", "error");
    } finally {
      setApprovingId(null);
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

        {/* HERO SECTION */}
        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck color="#a855f7" weight="fill" /> Transfer Logistics
            </h1>
            <p>Approve and monitor assets moving between physical branches.</p>
          </div>
        </div>

        {/* REPLACES OLD TABLE WITH PREMIUM ROUTE CARDS */}
        <div className="clean-list">
          {loading ? (
            <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-purple" /><p>Loading logistics data...</p></div>
          ) : transfers.length === 0 ? (
            <div className="empty-state-card"><span style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block' }}>🚚</span>No inter-branch transfers found.</div>
          ) : (
            transfers.map(t => (
              <div key={t.transferId} className="clean-row glass-panel hover-lift" style={{ padding: '20px', borderLeft: t.status === 'PENDING' ? '4px solid #f59e0b' : '4px solid #10b981' }}>
                
                <div className="cl-left" style={{ flex: 2, minWidth: '300px' }}>
                  <div className="cl-icon" style={{ background: t.status === 'PENDING' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: t.status === 'PENDING' ? '#f59e0b' : '#10b981' }}>
                    {t.status === 'PENDING' ? <ArrowsLeftRight size={24} weight="bold"/> : <CheckCircle size={24} weight="fill"/>}
                  </div>
                  <div>
                    <div className="cl-title" style={{ fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#ef4444' }}>{t.fromBranch}</span> 
                      <ArrowsLeftRight size={14} weight="bold" style={{ color: '#64748b' }}/> 
                      <span style={{ color: '#10b981' }}>{t.toBranch}</span>
                    </div>
                    <div className="cl-sub" style={{ marginTop: '4px' }}>
                      Ticket: <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{t.transferId}</span> • Asset: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{t.assetId}</span>
                    </div>
                  </div>
                </div>
                
                <div className="cl-middle" style={{ flex: 1, minWidth: '150px' }}>
                  <span className={`status-pill ${t.status === 'PENDING' ? 'orange' : 'green'}`}>{t.status}</span>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>Requested: <strong style={{ color: '#cbd5e1' }}>{t.date}</strong></div>
                </div>
                
                <div className="cl-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: '150px' }}>
                  {isSuperAdmin && t.status === 'PENDING' ? (
                    <button 
                      className="premium-btn" 
                      onClick={() => handleApprove(t)} 
                      disabled={approvingId === t.transferId}
                      style={{ background: '#10b981', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {approvingId === t.transferId ? <CircleNotch size={18} className="ph-spin" /> : <><CheckCircle size={18} weight="bold" /> Approve Transfer</>}
                    </button>
                  ) : t.status !== 'PENDING' ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#10b981', fontSize: '1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle size={16} weight="fill" /> Completed
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '4px' }}>Logistics Updated</div>
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>Pending Admin Approval</div>
                  )}
                </div>

              </div>
            ))
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------
          🎨 PREMIUM CSS FOR TRANSFERS PAGE
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
        
        .empty-state-card { background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 50px 20px; text-align: center; color: #94a3b8; font-size: 1.1rem; font-weight: bold; }
        .text-purple { color: #a855f7; }
        
        /* Clean List (Ticket Rows) */
        .clean-list { display: flex; flex-direction: column; gap: 15px; }
        .clean-row { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-radius: 16px; flex-wrap: wrap; gap: 15px; }
        
        .cl-left { display: flex; align-items: flex-start; gap: 20px; }
        .cl-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }
        .cl-title { font-weight: 700; margin-bottom: 3px; }
        .cl-sub { font-size: 0.8rem; color: #94a3b8; }
        
        .status-pill { padding: 6px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; width: max-content; }
        .status-pill.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-pill.orange { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
      `}</style>
    </Layout>
  );
}