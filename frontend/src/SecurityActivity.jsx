import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, CircleNotch, Desktop, DeviceMobile, 
  Globe, Clock, WarningCircle, Eye, Prohibit, Funnel
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function SecurityActivity() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const isSuperAdmin = tpoData?.accessType === 'superadmin';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [deviceFilter, setDeviceFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/admin/security-logs`);
        if (res.data.success) {
          setLogs(res.data.logs || []);
        }
      } catch (err) {
        console.error("Failed to load security logs", err);
      } finally {
        setLoading(false);
      }
    };
    if (isSuperAdmin) fetchLogs();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
          <Prohibit size={64} color="#ef4444" weight="fill" style={{ marginBottom: '20px' }} />
          <h2>Restricted Security Module</h2>
          <p style={{ color: 'var(--text-muted)' }}>Only Super Administrators have authorization to inspect user security logs.</p>
        </div>
      </Layout>
    );
  }

  const uniqueRoles = ['All', ...new Set(logs.map(l => l.role).filter(Boolean))];

  const filteredLogs = logs.filter(log => {
    const q = searchQuery.toLowerCase();
    const matchQuery = (log.userName || '').toLowerCase().includes(q) ||
                       (log.email || '').toLowerCase().includes(q) ||
                       (log.ipAddress || '').toLowerCase().includes(q) ||
                       (log.branch || '').toLowerCase().includes(q);
    const matchRole = roleFilter === 'All' || log.role === roleFilter;
    const matchDevice = deviceFilter === 'All' || log.device === deviceFilter;
    return matchQuery && matchRole && matchDevice;
  });

  const totalLogins = logs.length;
  const mobileCount = logs.filter(l => l.device === 'Mobile').length;
  const desktopCount = logs.filter(l => l.device === 'Desktop').length;
  const uniqueUsers = new Set(logs.map(l => l.email)).size;

  const userHistory = selectedUser ? logs.filter(l => l.email === selectedUser.email) : [];

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck color="#38bdf8" weight="fill" /> User Login & Security Activity
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Live audit logging of internal staff authentications, hardware profiles, and IP networks.
            </p>
          </div>
        </div>

        {/* SECURITY KPIS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
          <div style={{ background: '#0f1523', border: '1px solid #1e293b', padding: '20px', borderRadius: '14px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Total Recorded Logins</div>
            <div style={{ fontSize: '2rem', color: '#38bdf8', fontWeight: 'bold' }}>{totalLogins}</div>
          </div>
          <div style={{ background: '#0f1523', border: '1px solid #1e293b', padding: '20px', borderRadius: '14px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Unique Staff Accounts</div>
            <div style={{ fontSize: '2rem', color: '#10b981', fontWeight: 'bold' }}>{uniqueUsers}</div>
          </div>
          <div style={{ background: '#0f1523', border: '1px solid #1e293b', padding: '20px', borderRadius: '14px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Desktop Workstations</div>
            <div style={{ fontSize: '2rem', color: '#f59e0b', fontWeight: 'bold' }}>{desktopCount}</div>
          </div>
          <div style={{ background: '#0f1523', border: '1px solid #1e293b', padding: '20px', borderRadius: '14px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Mobile Logins</div>
            <div style={{ fontSize: '2rem', color: '#a855f7', fontWeight: 'bold' }}>{mobileCount}</div>
          </div>
        </div>

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
            type="text" 
            className="sleek-input" 
            placeholder="Search staff, email, branch, or IP..." 
            style={{ width: '320px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select className="sleek-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            {uniqueRoles.map(r => <option key={r} value={r}>{r === 'All' ? 'All Roles' : r}</option>)}
          </select>

          <select className="sleek-select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
            <option value="All">All Devices</option>
            <option value="Desktop">Desktop Only</option>
            <option value="Mobile">Mobile Only</option>
            <option value="Tablet">Tablet Only</option>
          </select>
        </div>

        {/* AUDIT LOG TABLE */}
        <div className="table-container">
          <table className="modern-table" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th>User Identity</th>
                <th>Role & Branch</th>
                <th>Network & IP</th>
                <th>Device & System</th>
                <th>Timestamp</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="#38bdf8" /></td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No login activity matches the criteria.</td></tr>
              ) : (
                filteredLogs.map((log, i) => (
                  <tr key={i}>
                    <td>
                      <span className="primary-text" style={{ fontWeight: 'bold' }}>{log.userName}</span>
                      <span className="sub-text">{log.email}</span>
                    </td>
                    <td>
                      <span className="primary-text">{log.role}</span>
                      <span className="sub-text">{log.branch}</span>
                    </td>
                    <td>
                      <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.9rem' }}>{log.ipAddress}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {log.device === 'Mobile' ? <DeviceMobile size={18} color="#a855f7" /> : <Desktop size={18} color="#3b82f6" />}
                        <span style={{ color: '#fff', fontSize: '0.85rem' }}>{log.os} • {log.browser}</span>
                      </div>
                    </td>
                    <td>
                      <span className="primary-text" style={{ fontSize: '0.85rem' }}>{log.timestamp}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => setSelectedUser(log)}
                        style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid #0284c7', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}
                      >
                        <Eye size={16} /> Audit User
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* USER AUDIT DETAIL MODAL */}
        {selectedUser && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="modal-card" style={{ maxWidth: '650px', width: '100%', maxHeight: '85vh', background: '#0f1523', border: '1px solid #38bdf8', borderRadius: '16px', padding: '2rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Login History: {selectedUser.userName}</h3>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedUser.email} • {selectedUser.role}</span>
                </div>
                <button onClick={() => setSelectedUser(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>Close</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {userHistory.map((item, idx) => (
                  <div key={idx} style={{ background: '#161e2e', border: '1px solid #1e293b', borderRadius: '10px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem' }}>{item.os} • {item.browser} ({item.device})</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>IP Network: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{item.ipAddress}</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>Session Recorded</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>{item.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}