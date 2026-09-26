import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Tag, Plus, X } from '@phosphor-icons/react';
import Layout from './Layout';
import MediaTopNav from './MediaTopNav';
import { API_BASE } from './apiConfig';

export default function MediaCategories() {
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, social: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ category: 'Social Media', designType: '' });

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/design/tasks`);
      if (res.data.success) {
        setError('');
        setCategories(res.data.categories || []);
        const pending = (res.data.tasks || []).filter(t => String(t.status).toLowerCase() !== 'completed').length;
        setCounts({ pending, social: (res.data.social || []).length });
      }
    } catch (err) { setError(err.response?.data?.message || 'Could not load design categories.'); } finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setNotice('');
    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE}/api/design/category`, form);
      if (!response.data.success) throw new Error(response.data.message || 'Could not add this design type.');
      setIsModalOpen(false);
      setForm({ category: 'Social Media', designType: '' });
      setNotice(response.data.message || 'Design type added.');
      fetchData();
    } catch (err) { setNotice(err.response?.data?.message || err.message || 'Failed to add category.'); } finally { setSubmitting(false); }
  };

  const groupedCategories = {};
  categories.forEach(c => {
    if (!groupedCategories[c.category]) groupedCategories[c.category] = [];
    groupedCategories[c.category].push(c.designType);
  });

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <MediaTopNav title="Categories" subtitle="Master list of available design types." pendingCount={counts.pending} publishedCount={counts.social} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button onClick={() => setIsModalOpen(true)} className="hover-lift" style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus weight="bold" /> Add Category
          </button>
        </div>

        {notice && <div role="status" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, color: '#cbd5e1', background: 'rgba(255,255,255,.05)' }}>{notice}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#ec4899" /></div>
        ) : error ? (
          <div style={{ background: 'var(--card-bg)', padding: '45px', textAlign: 'center', borderRadius: '16px', border: '1px solid rgba(248,113,113,.25)' }}><p style={{ color: '#fca5a5', margin: '0 0 14px' }}>{error}</p><button type="button" onClick={() => { setLoading(true); fetchData(); }} style={{ padding: '9px 17px', border: 0, borderRadius: 9, background: '#ec4899', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Retry</button></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {Object.keys(groupedCategories).map((masterCat, i) => (
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
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f1523', width: '100%', maxWidth: '500px', borderRadius: '20px', padding: '30px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#fff' }}>New Design Type</h2>
              <X size={24} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setIsModalOpen(false)} />
            </div>
            <form onSubmit={handleAddCategory}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Master Category</label>
                <select className="sleek-select" style={{ width: '100%' }} value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  <option value="Placement">Placement</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Event">Event</option>
                  <option value="Activity">Campus Activity</option>
                  <option value="Company">Company / Client</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Specific Design Type Name</label>
                <input type="text" required className="sleek-input" style={{ width: '100%' }} placeholder="e.g., Instagram Reel, Workshop Poster..." value={form.designType} onChange={e => setForm({...form, designType: e.target.value})} />
              </div>
              <button type="submit" disabled={submitting} style={{ width: '100%', padding: '14px', background: '#ec4899', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                {submitting ? 'Saving...' : 'Save Category'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
