import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, MapPin, Plus, Trash, X, WarningCircle
} from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal-u0l6.onrender.com";

export default function Branches() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  const userRole = (tpoData?.role || '').toUpperCase();
  const isSuperAdmin = tpoData?.accessType === 'superadmin' || userRole.includes('ADMIN') || userRole.includes('HEAD') || userRole.includes('MANAGER');

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ no: '', region: '', branch: '' });

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/admin/branches`);
      if (response.data.success) {
        setBranches(response.data.branches || []);
      }
    } catch (error) {
      console.error("Failed to fetch branches", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) {
      window.location.href = '/dashboard';
    } else {
      fetchBranches();
    }
  }, [isSuperAdmin]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formData.branch || !formData.region) return alert("Region and Branch are required");
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/admin/branches/add`, formData);
      if (res.data.success) {
        setIsModalOpen(false);
        setFormData({ no: '', region: '', branch: '' });
        fetchBranches();
      }
    } catch (err) {
      alert("Failed to add branch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (branchName) => {
    if (!window.confirm(`Are you sure you want to delete ${branchName}?`)) return;
    try {
      const res = await axios.post(`${API_BASE}/api/admin/branches/delete`, { branch: branchName });
      if (res.data.success) {
        setBranches(branches.filter(b => b.branch !== branchName));
      }
    } catch (err) {
      alert("Failed to delete branch");
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MapPin color="var(--accent-primary)" weight="fill" /> Branch Management
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Control the official master list of active branch locations.</p>
          </div>
          <button className="btn-action" style={{ width: 'auto', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsModalOpen(true)}>
            <Plus weight="bold" /> Add New Branch
          </button>
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>No.</th>
                <th style={{ width: '40%' }}>Region / State</th>
                <th style={{ width: '40%' }}>Branch Location</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}>
                    <CircleNotch size={32} className="ph-spin" color="var(--accent-primary)" />
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No branches found. Add a branch to get started.
                  </td>
                </tr>
              ) : (
                branches.map((b, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)' }}>{b.no || i + 1}</td>
                    <td><strong style={{ color: 'var(--text-main)' }}>{b.region}</strong></td>
                    <td><strong style={{ color: '#38bdf8' }}>{b.branch}</strong></td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => handleDelete(b.branch)} 
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' }} 
                        title="Delete Branch"
                      >
                        <Trash size={18} weight="bold" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><MapPin color="var(--accent-primary)" /> Add Official Branch</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsModalOpen(false)} />
            </div>

            <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '15px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '20px', fontSize: '0.8rem', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <WarningCircle size={20} weight="fill" style={{ flexShrink: 0 }} />
              <div>Adding a branch here will officially register it in the Google Sheets database across all dropdown menus in the portal.</div>
            </div>

            <form onSubmit={handleAdd}>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Index Number (Optional)</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={formData.no} onChange={e => setFormData({...formData, no: e.target.value})} placeholder="e.g. 35" />
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Region / State *</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} placeholder="e.g. Kerala, Tamil Nadu" required />
              </div>

              <div className="form-group" style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Branch Name *</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} placeholder="e.g. Calicut" required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-action" style={{ width: 'auto' }} disabled={isSubmitting}>
                  {isSubmitting ? <CircleNotch size={20} className="ph-spin" /> : 'Register Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}