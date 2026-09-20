import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Eye, ImageSquare } from '@phosphor-icons/react';
import Layout from './Layout';
import MediaTopNav from './MediaTopNav';
import { API_BASE } from './apiConfig';

export default function MediaPreview() {
  const [tasks, setTasks] = useState([]);
  const [socialCount, setSocialCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/design/tasks`);
        if (res.data.success) {
          setTasks(res.data.tasks || []);
          setSocialCount((res.data.social || []).length);
        }
      } catch (err) {} finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };

  const completedTasks = tasks.filter(t => t.session2File && String(t.status).toLowerCase() === 'completed');
  const pendingCount = tasks.filter(t => String(t.status).toLowerCase() !== 'completed').length;

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <MediaTopNav 
           title="Preview Gallery" 
           subtitle="Visual archive of all finalized and approved creatives."
           pendingCount={pendingCount}
           publishedCount={socialCount}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#ec4899" /></div>
        ) : completedTasks.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', padding: '60px', textAlign: 'center', borderRadius: '16px', border: '1px dashed var(--card-border)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0 }}>No finalized creatives found. Complete tasks to see them appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {completedTasks.map((t, i) => (
              <div key={i} className="hover-lift" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '220px', background: '#1e293b', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   {t.session2File ? (
                     <img src={getDriveImage(t.session2File) || getDriveImage(t.profilePhoto)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Creative Preview"/>
                   ) : (
                     <ImageSquare size={48} color="#475569" />
                   )}
                   <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', color: '#fff', fontWeight: 'bold', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                     {t.designType}
                   </div>
                </div>
                <div style={{ padding: '20px' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#fff' }}>{t.studentName}</h3>
                  <p style={{ margin: 0, color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold' }}>{t.company}</p>
                  
                  <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                    <a href={t.session2File} target="_blank" rel="noreferrer" style={{ flex: 1, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '10px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', transition: '0.2s', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      <Eye size={18} weight="bold" /> View Original File
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`.hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); } .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); }`}</style>
    </Layout>
  );
}