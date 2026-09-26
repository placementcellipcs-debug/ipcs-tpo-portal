import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, FolderOpen, Eye } from '@phosphor-icons/react';
import Layout from './Layout';
import MediaTopNav from './MediaTopNav';
import { API_BASE } from './apiConfig';

export default function MediaFiles() {
  const [files, setFiles] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, social: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/design/tasks`);
        if (res.data.success) {
          setError('');
          setFiles(res.data.files || []);
          const pending = (res.data.tasks || []).filter(t => String(t.status).toLowerCase() !== 'completed').length;
          setCounts({ pending, social: (res.data.social || []).length });
        }
      } catch (err) { setError(err.response?.data?.message || 'Could not load the file vault.'); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <MediaTopNav 
           title="File Vault" 
           subtitle="Secure repository of all uploaded drafts and final renders."
           pendingCount={counts.pending}
           publishedCount={counts.social}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#ec4899" /></div>
        ) : error ? (
          <div style={{ background: 'var(--card-bg)', padding: '45px', textAlign: 'center', borderRadius: '16px', border: '1px solid rgba(248,113,113,.25)' }}><p style={{ color: '#fca5a5', margin: '0 0 14px' }}>{error}</p><button type="button" onClick={() => window.location.reload()} style={{ padding: '9px 17px', border: 0, borderRadius: 9, background: '#ec4899', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Retry</button></div>
        ) : (
          <div className="table-container" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)', color: '#94a3b8', textAlign: 'left', fontSize: '0.85rem' }}>
                  <th style={{ padding: '15px 20px' }}>File Name / ID</th>
                  <th style={{ padding: '15px 20px' }}>Task Link</th>
                  <th style={{ padding: '15px 20px' }}>Session Level</th>
                  <th style={{ padding: '15px 20px' }}>Timestamp</th>
                  <th style={{ padding: '15px 20px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={f.fileId || `${f.designId}-${f.session}-${i}`} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                          <FolderOpen size={20} weight="fill" />
                        </div>
                        <div>
                          <div style={{ color: '#fff', fontWeight: 'bold', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.fileName}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{f.fileId}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '15px 20px' }}><span style={{ color: '#ec4899', fontWeight: 'bold', letterSpacing: '0.5px' }}>{f.designId}</span></td>
                    <td style={{ padding: '15px 20px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', background: String(f.session || '').includes('2') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: String(f.session || '').includes('2') ? '#10b981' : '#3b82f6', border: `1px solid ${String(f.session || '').includes('2') ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}` }}>
                        {f.session}
                      </span>
                    </td>
                    <td style={{ padding: '15px 20px', color: '#e2e8f0', fontSize: '0.85rem' }}>{f.date}</td>
                    <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                      <a href={f.link} target="_blank" rel="noreferrer" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px', border: '1px solid rgba(59, 130, 246, 0.3)', transition: '0.2s' }}>
                        <Eye size={16} weight="bold"/> Preview File
                      </a>
                    </td>
                  </tr>
                ))}
                {files.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No files uploaded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
