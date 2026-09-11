import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Wrench } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetMaintenance() {
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/assets/maintenance`).then(res => setMaintenance(res.data.maintenance || [])).finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Wrench color="#f59e0b" weight="fill" /> Maintenance Lab</h1>
            <p>Track assets sent for repair and maintenance logs.</p>
          </div>
        </div>

        <div className="clean-list">
          {loading ? <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /></div> : maintenance.length === 0 ? <div className="empty-state-card">No maintenance records found.</div> : 
            maintenance.map(m => (
            <div key={m.maintenanceId} className="clean-row glass-panel hover-lift" style={{ padding: '20px', borderLeft: m.status === 'OPEN' ? '4px solid #ef4444' : '4px solid #10b981' }}>
              <div className="cl-left" style={{ flex: 2 }}>
                <div className="cl-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><Wrench size={24} weight="fill"/></div>
                <div>
                  <div className="cl-title" style={{ fontSize: '1rem', color: '#fff' }}>{m.issue}</div>
                  <div className="cl-sub">Asset: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{m.assetId}</strong></div>
                </div>
              </div>
              <div className="cl-middle">
                <span className={`status-pill ${m.status === 'OPEN' ? 'red' : 'green'}`}>{m.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}