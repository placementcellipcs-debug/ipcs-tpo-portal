import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, ArrowsLeftRight, CheckCircle } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetTransfers() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/assets/transfers`).then(res => setTransfers(res.data.transfers || [])).finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ArrowsLeftRight color="#a855f7" weight="bold" /> Transfer Logistics</h1>
            <p>Approve and monitor assets moving between branches.</p>
          </div>
        </div>

        <div className="clean-list">
          {loading ? <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /></div> : transfers.length === 0 ? <div className="empty-state-card">No transfers found.</div> : 
            transfers.map(t => (
            <div key={t.transferId} className="clean-row glass-panel hover-lift" style={{ padding: '20px', borderLeft: t.status === 'PENDING' ? '4px solid #f59e0b' : '4px solid #10b981' }}>
              <div className="cl-left" style={{ flex: 2 }}>
                <div className="cl-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}><ArrowsLeftRight size={24} weight="fill"/></div>
                <div>
                  <div className="cl-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#ef4444' }}>{t.fromBranch}</span> ➔ <span style={{ color: '#10b981' }}>{t.toBranch}</span>
                  </div>
                  <div className="cl-sub">Asset: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{t.assetId}</strong></div>
                </div>
              </div>
              <div className="cl-middle">
                <span className={`status-pill ${t.status === 'PENDING' ? 'orange' : 'green'}`}>{t.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}