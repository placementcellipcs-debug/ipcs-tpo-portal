import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Wrench, CheckCircle, WarningCircle, X } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetMaintenance() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveForm, setResolveForm] = useState({ cost: '', remarks: '' });

  const fetchMaintenance = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/assets/maintenance`);
      if (res.data.success) setMaintenance(res.data.maintenance);
    } catch (err) { console.error("Error", err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchMaintenance(); }, []);

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/v1/assets/maintenance/resolve`, { maintenanceId: resolveModal.maintenanceId, assetId: resolveModal.assetId, cost: resolveForm.cost, remarks: resolveForm.remarks });
      setResolveModal(null); setResolveForm({ cost: '', remarks: '' }); fetchMaintenance();
    } catch (err) { alert("Failed to resolve."); }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}><Wrench color="#f59e0b" weight="fill" /> Maintenance & Repairs</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Track assets that are currently defective or sent for repair.</p>
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead><tr><th>Maintenance ID</th><th>Asset ID</th><th>Issue Reported</th><th>Reported Date</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
            <tbody>
              {loading ? (<tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="#f59e0b"/></td></tr>) 
              : maintenance.length === 0 ? (<tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No maintenance records found.</td></tr>) 
              : maintenance.map(m => (
                <tr key={m.maintenanceId}>
                  <td><span className="primary-text" style={{ color: '#f59e0b' }}>{m.maintenanceId}</span></td>
                  <td><span className="primary-text" style={{ fontFamily: 'monospace' }}>{m.assetId}</span></td>
                  <td><div style={{ color: '#fff', fontSize: '0.9rem', maxWidth: '250px', whiteSpace: 'normal' }}>{m.issue}</div></td>
                  <td><span className="sub-text">{m.date}</span></td>
                  <td><span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: m.status === 'OPEN' ? '#ef4444' : '#10b981' }}>{m.status}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    {m.status === 'OPEN' ? (
                      <button onClick={() => setResolveModal(m)} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Mark Resolved</button>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cost: ₹{m.cost}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {resolveModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="modal-card" style={{ maxWidth: '400px', width: '100%', background: '#0f1523', border: '1px solid #10b981', borderRadius: '16px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h2 style={{ margin: 0, color: '#10b981' }}>Resolve Maintenance</h2><X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setResolveModal(null)} /></div>
              <form onSubmit={handleResolveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div><label className="data-label">Repair Cost (₹)</label><input type="number" className="sleek-input" style={{ width: '100%' }} value={resolveForm.cost} onChange={e => setResolveForm({...resolveForm, cost: e.target.value})} required /></div>
                <div><label className="data-label">Resolution Remarks</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={resolveForm.remarks} onChange={e => setResolveForm({...resolveForm, remarks: e.target.value})} required /></div>
                <button type="submit" className="btn-action" style={{ background: '#10b981', color: '#0f172a', marginTop: '10px' }}>Complete Repair</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}