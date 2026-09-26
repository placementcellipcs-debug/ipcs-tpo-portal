import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, ArrowsClockwise, ImageSquare, VideoCamera } from '@phosphor-icons/react';
import Layout from './Layout';
import MediaTopNav from './MediaTopNav';
import { API_BASE } from './apiConfig';

export default function MediaSettings() {
  const [settings, setSettings] = useState({});
  const [counts, setCounts] = useState({ pending: 0, social: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/design/tasks`);
      if (res.data.success) {
        setError('');
        setSettings(res.data.settings || {});
        const pending = (res.data.tasks || []).filter(t => String(t.status).toLowerCase() !== 'completed').length;
        setCounts({ pending, social: (res.data.social || []).length });
      }
    } catch (err) { setError(err.response?.data?.message || 'Could not load studio settings.'); } finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSyncExisting = async () => {
    if (!window.confirm("This will scan the placement sheet and generate tasks for existing placed students. Proceed?")) return;
    setSyncing(true);
    try {
      const res = await axios.post(`${API_BASE}/api/design/sync-existing`);
      setNotice(res.data.message || 'Historical placements synced.');
      fetchData();
    } catch (err) { setNotice(err.response?.data?.message || 'Sync failed. Check the server connection.'); } finally { setSyncing(false); }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <MediaTopNav title="Studio Settings" subtitle="System automation and directory config." pendingCount={counts.pending} publishedCount={counts.social} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#ec4899" /></div>
        ) : error ? (
          <div style={{ background: 'var(--card-bg)', padding: '45px', textAlign: 'center', borderRadius: '16px', border: '1px solid rgba(248,113,113,.25)' }}><p style={{ color: '#fca5a5', margin: '0 0 14px' }}>{error}</p><button type="button" onClick={() => { setLoading(true); fetchData(); }} style={{ padding: '9px 17px', border: 0, borderRadius: 9, background: '#ec4899', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Retry</button></div>
        ) : (
          <>
          {notice && <div role="status" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(52,211,153,.3)', color: '#6ee7b7', background: 'rgba(6,78,59,.2)' }}>{notice}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
            
            <div style={{ background: 'var(--card-bg)', padding: '30px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowsClockwise color="#ec4899" /> Sync Historical Data</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '25px' }}>
                Scan the <b>Opening Applied</b> placement sheet to automatically detect any students who were previously placed (before the Design Automation was turned on) and instantly generate creative tasks for them in the Active Queue.
              </p>
              <button 
                onClick={handleSyncExisting} 
                disabled={syncing}
                style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '14px 20px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: '0.2s', width: '100%', justifyContent: 'center', boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)' }}
              >
                {syncing ? <CircleNotch size={20} className="ph-spin" /> : <ArrowsClockwise size={20} weight="bold" />}
                {syncing ? 'Scanning Placement Database...' : 'Run Full Legacy Sync'}
              </button>
            </div>

            <div style={{ background: 'var(--card-bg)', padding: '30px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}><ImageSquare color="#3b82f6" /> Output Directories</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '25px' }}>
                Google Drive IDs where the system automatically routes all uploaded media and completed posters. To change these, edit the "Design_Settings" tab in Google Sheets.
              </p>
              <div style={{ display: 'grid', gap: '15px' }}>
                <div style={{ padding: '15px 20px', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}><ImageSquare size={16}/> Poster Drive Folder ID</span>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.05rem', wordBreak: 'break-all' }}>{settings.posterFolder || 'Not Set'}</span>
                </div>
                <div style={{ padding: '15px 20px', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}><VideoCamera size={16}/> Video Drive Folder ID</span>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.05rem', wordBreak: 'break-all' }}>{settings.videoFolder || 'Not Set'}</span>
                </div>
              </div>
            </div>

          </div>
          </>
        )}
      </div>
    </Layout>
  );
}
