import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, ShareNetwork, InstagramLogo, LinkedinLogo, FacebookLogo, YoutubeLogo, ArrowSquareOut } from '@phosphor-icons/react';
import Layout from './Layout';
import MediaTopNav from './MediaTopNav';
import { API_BASE } from './apiConfig';

export default function MediaSocial() {
  const [social, setSocial] = useState([]);
  const [counts, setCounts] = useState({ pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/design/tasks`);
        if (res.data.success) {
          setSocial(res.data.social || []);
          setCounts({ pending: (res.data.tasks || []).filter(t => String(t.status).toLowerCase() !== 'completed').length });
        }
      } catch (err) {} finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const getPlatformIcon = (platform) => {
    const p = String(platform).toLowerCase();
    if (p.includes('insta')) return <InstagramLogo size={24} color="#e1306c" weight="fill" />;
    if (p.includes('link')) return <LinkedinLogo size={24} color="#0a66c2" weight="fill" />;
    if (p.includes('face')) return <FacebookLogo size={24} color="#1877f2" weight="fill" />;
    if (p.includes('you')) return <YoutubeLogo size={24} color="#ff0000" weight="fill" />;
    return <ShareNetwork size={24} color="#94a3b8" weight="fill" />;
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <MediaTopNav title="Social Media" subtitle="Track all active publications and platform performance." pendingCount={counts.pending} publishedCount={social.length} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#ec4899" /></div>
        ) : (
          <div className="table-container" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)', color: '#94a3b8', textAlign: 'left', fontSize: '0.85rem' }}>
                  <th style={{ padding: '15px 20px' }}>Platform & ID</th>
                  <th style={{ padding: '15px 20px' }}>Post Link</th>
                  <th style={{ padding: '15px 20px' }}>Assoc. Task</th>
                  <th style={{ padding: '15px 20px' }}>Date Published</th>
                  <th style={{ padding: '15px 20px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {social.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {getPlatformIcon(s.platform)}
                        </div>
                        <div><div style={{ color: '#fff', fontWeight: 'bold' }}>{s.platform}</div><div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s.socialId}</div></div>
                      </div>
                    </td>
                    <td style={{ padding: '15px 20px' }}>
                      <div style={{ fontWeight: 'bold', color: '#e2e8f0', marginBottom: '4px' }}>{s.postType}</div>
                      <a href={s.link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}>
                        View Live Post <ArrowSquareOut size={14} weight="bold" />
                      </a>
                    </td>
                    <td style={{ padding: '15px 20px' }}><span style={{ color: '#ec4899', fontWeight: 'bold', background: 'rgba(236,72,153,0.1)', padding: '6px 12px', borderRadius: '8px' }}>{s.designId}</span></td>
                    <td style={{ padding: '15px 20px', color: '#e2e8f0', fontSize: '0.85rem' }}>{s.date}</td>
                    <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                      <span style={{ padding: '6px 12px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', textTransform: 'uppercase' }}>{s.status}</span>
                    </td>
                  </tr>
                ))}
                {social.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No social media posts tracked yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}