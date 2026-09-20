import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch } from '@phosphor-icons/react';
import Layout from './Layout';
import MediaTopNav from './MediaTopNav';
import { API_BASE } from './apiConfig';

export default function MediaLogs() {
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, social: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/design/tasks`);
        if (res.data.success) {
          setLogs(res.data.logs || []);
          const pending = (res.data.tasks || []).filter(t => String(t.status).toLowerCase() !== 'completed').length;
          setCounts({ pending, social: (res.data.social || []).length });
        }
      } catch (err) {} finally { setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <MediaTopNav title="Activity Logs" subtitle="Security and timeline tracking for all studio changes." pendingCount={counts.pending} publishedCount={counts.social} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#ec4899" /></div>
        ) : (
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
            <div style={{ position: 'relative', paddingLeft: '30px' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '14px', width: '2px', background: 'rgba(255,255,255,0.1)' }}></div>
              
              {logs.map((log, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: '25px' }}>
                  <div style={{ position: 'absolute', left: '-22px', top: '15px', width: '12px', height: '12px', borderRadius: '50%', background: '#ec4899', border: '3px solid #0f1523', zIndex: 2 }}></div>
                  
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', transition: '0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                        {String(log.user).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>{log.action}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.user} • {log.date}</div>
                      </div>
                    </div>
                    <div>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 'bold', border: '1px solid var(--card-border)' }}>{log.designId}</span>
                    </div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No activity recorded yet.</div>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}