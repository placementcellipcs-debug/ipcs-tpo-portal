import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, PaperPlaneRight, ArrowsLeftRight, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetTransfers() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const isSuperAdmin = tpoData?.accessType === 'superadmin';

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const fetchTransfers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/assets/transfers`);
      if (res.data.success) setTransfers(res.data.transfers);
    } catch (err) { console.error("Error loading transfers", err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTransfers(); }, []);

  const handleApprove = async (transfer) => {
    if (!window.confirm("Approve transfer and move asset?")) return;
    try {
      await axios.post(`${API_BASE}/api/v1/assets/transfers/approve`, { transferId: transfer.transferId, assetId: transfer.assetId, toBranch: transfer.toBranch, userName: tpoData.name });
      fetchTransfers();
    } catch (err) { alert("Failed to approve."); }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}><ArrowsLeftRight color="#a855f7" weight="bold" /> Inter-Branch Transfers</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Approve and monitor assets moving between branches.</p>
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead><tr><th>Transfer ID</th><th>Asset ID</th><th>Origin Branch</th><th>Destination Branch</th><th>Status</th>{isSuperAdmin && <th style={{ textAlign: 'center' }}>Action</th>}</tr></thead>
            <tbody>
              {loading ? (<tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="#a855f7"/></td></tr>) 
              : transfers.length === 0 ? (<tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No transfers found.</td></tr>) 
              : transfers.map(t => (
                <tr key={t.transferId}>
                  <td><span className="primary-text" style={{ color: '#a855f7' }}>{t.transferId}</span><span className="sub-text">{t.date}</span></td>
                  <td><span className="primary-text" style={{ fontFamily: 'monospace' }}>{t.assetId}</span></td>
                  <td><span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>{t.fromBranch}</span></td>
                  <td><span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>{t.toBranch}</span></td>
                  <td><span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: t.status === 'PENDING' ? '#f59e0b' : '#38bdf8' }}>{t.status}</span></td>
                  {isSuperAdmin && (
                    <td style={{ textAlign: 'center' }}>
                      {t.status === 'PENDING' ? (
                        <button onClick={() => handleApprove(t)} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Approve</button>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Completed</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}