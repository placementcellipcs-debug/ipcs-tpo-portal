import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Tag } from '@phosphor-icons/react';
import Layout from './Layout';
import MediaTopNav from './MediaTopNav';
import { API_BASE } from './apiConfig';

export default function MediaCategories() {
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, social: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/design/tasks`);
        if (res.data.success) {
          setCategories(res.data.categories || []);
          const pending = (res.data.tasks || []).filter(t => String(t.status).toLowerCase() !== 'completed').length;
          setCounts({ pending, social: (res.data.social || []).length });
        }
      } catch (err) {} finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const groupedCategories = {};
  categories.forEach(c => {
    if (!groupedCategories[c.category]) groupedCategories[c.category] = [];
    groupedCategories[c.category].push(c.designType);
  });

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <MediaTopNav title="Categories" subtitle="Master list of available design types." pendingCount={counts.pending} publishedCount={counts.social} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#ec4899" /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {Object.keys(groupedCategories).length === 0 ? (
               <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: '16px', border: '1px dashed var(--card-border)' }}>No categories defined in sheet.</div>
            ) : (
              Object.keys(groupedCategories).map((masterCat, i) => (
                <div key={i} style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                  <div style={{ padding: '15px 20px', background: 'rgba(236, 72, 153, 0.05)', borderBottom: '1px solid var(--card-border)', borderLeft: '4px solid #ec4899' }}>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Tag color="#ec4899"/> {masterCat}</h3>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {groupedCategories[masterCat].map((subType, j) => (
                      <div key={j} style={{ padding: '10px 15px', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid var(--card-border)', color: '#cbd5e1', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }}></div> {subType}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}