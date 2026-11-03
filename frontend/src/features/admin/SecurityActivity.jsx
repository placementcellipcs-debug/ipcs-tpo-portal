import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { 
  ShieldCheck, CircleNotch,
  Eye, Prohibit
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDateTime, parsePortalDateTime } from '../../utils/dateFormat';

export default function SecurityActivity() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const isSuperAdmin = tpoData?.accessType === 'superadmin';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [deviceFilter, setDeviceFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedUser) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = event => { if (event.key === 'Escape') setSelectedUser(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedUser]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/admin/security-logs`);
        if (res.data.success) {
          setLogs(res.data.logs || []);
        }
      } catch (err) { console.error("Failed to load security logs", err); } finally { setLoading(false); }
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

  const uniqueUsersMap = new Map();
  logs.forEach(log => {
    const email = (log.email || '').toLowerCase();
    if (!email) return;
    if (!uniqueUsersMap.has(email)) {
      uniqueUsersMap.set(email, { ...log, history: [log] });
    } else {
      uniqueUsersMap.get(email).history.push(log);
    }
  });
  
  const uniqueUsersList = Array.from(uniqueUsersMap.values());
  const uniqueRoles = ['All', ...new Set(uniqueUsersList.map(l => l.role).filter(Boolean))];

  const filteredUsers = uniqueUsersList.filter(log => {
    const q = searchQuery.toLowerCase();
    const matchQuery = (log.userName || '').toLowerCase().includes(q) ||
                       (log.email || '').toLowerCase().includes(q) ||
                       (log.ipAddress || '').toLowerCase().includes(q) ||
                       (log.branch || '').toLowerCase().includes(q);
    const matchRole = roleFilter === 'All' || log.role === roleFilter;
    const matchDevice = deviceFilter === 'All' || log.device === deviceFilter;
    return matchQuery && matchRole && matchDevice;
  });

  const checkIsActive = (timestamp) => {
    if (!timestamp) return false;
    const logDate = parsePortalDateTime(timestamp);
    if (!logDate) return true;
    return (currentTime - logDate.getTime()) < (4 * 60 * 60 * 1000);
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck color="var(--accent-primary)" weight="fill" /> User Login & Security Activity
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Live audit logging of internal staff authentications, hardware profiles, and IP networks.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
          <div style={{ background: '#0f1523', border: '1px solid #1e293b', padding: '20px', borderRadius: '14px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Total Recorded Logins</div>
            <div style={{ fontSize: '2rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{logs.length}</div>
          </div>
          <div style={{ background: '#0f1523', border: '1px solid #1e293b', padding: '20px', borderRadius: '14px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Unique Staff Accounts</div>
            <div style={{ fontSize: '2rem', color: '#10b981', fontWeight: 'bold' }}>{uniqueUsersList.length}</div>
          </div>
          <div style={{ background: '#0f1523', border: '1px solid #1e293b', padding: '20px', borderRadius: '14px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Desktop Workstations</div>
            <div style={{ fontSize: '2rem', color: '#f59e0b', fontWeight: 'bold' }}>{logs.filter(l => l.device === 'Desktop').length}</div>
          </div>
          <div style={{ background: '#0f1523', border: '1px solid #1e293b', padding: '20px', borderRadius: '14px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '5px' }}>Mobile Logins</div>
            <div style={{ fontSize: '2rem', color: '#a855f7', fontWeight: 'bold' }}>{logs.filter(l => l.device === 'Mobile').length}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" className="sleek-input" placeholder="Search staff, email, branch, or IP..." style={{ width: '320px' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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

        <div className="table-container">
          <table className="modern-table" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th>User Identity</th>
                <th>Role & Branch</th>
                <th>Latest IP</th>
                <th>Current Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="var(--accent-primary)" /></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No login activity matches the criteria.</td></tr>
              ) : (
                filteredUsers.map((user, i) => {
                  const isActive = checkIsActive(user.timestamp);
                  return (
                    <tr key={i}>
                      <td>
                        <span className="primary-text" style={{ fontWeight: 'bold' }}>{user.userName}</span>
                        <span className="sub-text">{user.email}</span>
                      </td>
                      <td>
                        <span className="primary-text">{user.role}</span>
                        <span className="sub-text">{user.branch}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--accent-primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}>{user.ipAddress}</span>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '20px', background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)', color: isActive ? '#10b981' : '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActive ? '#10b981' : '#94a3b8' }}></span>
                          {isActive ? 'Active Now' : 'Offline'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => setSelectedUser(user)}
                          style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-primary)', border: '1px solid #0284c7', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}
                        >
                          <Eye size={16} /> Audit User
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedUser && typeof document !== 'undefined' && createPortal(
          <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedUser(null); }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,14,.78)', backdropFilter: 'blur(7px)', zIndex: 100300, display: 'grid', placeItems: 'center', padding: '18px' }}>
            <div role="dialog" aria-modal="true" aria-labelledby="security-user-history-title" style={{ maxWidth: '700px', width: '100%', maxHeight: 'min(86dvh, 800px)', display: 'flex', flexDirection: 'column', background: 'linear-gradient(145deg, #172338, #0f1523)', border: '1px solid rgba(56,189,248,.5)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, borderBottom: '1px solid #1e293b', padding: '18px 22px', flexShrink: 0 }}>
                <div>
                  <h3 id="security-user-history-title" style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Login History: {selectedUser.userName || 'Staff user'}</h3>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedUser.email} • {selectedUser.role}</span>
                </div>
                <button type="button" onClick={() => setSelectedUser(null)} style={{ background: '#0b1320', border: '1px solid #334155', borderRadius: 9, padding: '8px 11px', color: '#cbd5e1', cursor: 'pointer' }}>Close</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '18px 22px 22px', overflowY: 'auto', overscrollBehavior: 'contain' }}>
                {(Array.isArray(selectedUser.history) ? selectedUser.history : []).length ? selectedUser.history.map((item, idx) => (
                  <div key={`${item.timestamp || 'login'}-${idx}`} style={{ background: '#111b2b', border: '1px solid #26354a', borderRadius: '10px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem' }}>{item.os} • {item.browser} ({item.device})</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>IP Network: <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{item.ipAddress}</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>Session Recorded</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>{formatPortalDateTime(item.timestamp, String(item.timestamp || ''))}</div>
                    </div>
                  </div>
                )) : <div style={{ padding: 22, color: '#94a3b8', textAlign: 'center' }}>No sign-in history is recorded for this account yet.</div>}
              </div>
            </div>
          </div>, document.body
        )}

      </div>
    </Layout>
  );
}
