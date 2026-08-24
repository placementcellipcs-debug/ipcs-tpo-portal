import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from './Layout';

export default function UserManagement() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // New User Form State
  const [formData, setFormData] = useState({
    userName: '', email: '', contact: '', password: '', 
    role: 'Regional Technical Head', course: '', sittingBranch: '', 
    assignedBranches: '', access: 'View Only'
  });

  const fetchUsers = async () => {
    try {
      const res = await axios.get('https://ipcs-tpo-portal.onrender.com/api/admin/users');
      if (res.data && res.data.success) {
        setUsers(res.data.users || []);
      }
    } catch (err) {
      console.error("Failed to load users", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await axios.post('https://ipcs-tpo-portal.onrender.com/api/admin/users/add', formData);
      if (res.data.success) {
        setIsModalOpen(false);
        setFormData({ userName: '', email: '', contact: '', password: '', role: 'Regional Technical Head', course: '', sittingBranch: '', assignedBranches: '', access: 'View Only' });
        setLoading(true);
        fetchUsers(); 
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (rowNumber, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete user: ${userName}?`)) return;
    
    try {
      const res = await axios.post('https://ipcs-tpo-portal.onrender.com/api/admin/users/delete', { rowNumber });
      if (res.data.success) {
        setUsers(users.filter(u => u.rowNumber !== rowNumber));
      }
    } catch (err) {
      alert("Failed to delete user.");
    }
  };

  // 🚨 SAFE ACCESS DENIED FALLBACK
  if (tpoData?.accessType !== 'superadmin') {
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⛔</div>
          <h2>Access Denied</h2>
          <p>You do not have Super Admin privileges to view this page.</p>
        </div>
      </Layout>
    );
  }

  // Guaranteed safe filtering
  const filteredUsers = (users || []).filter(u => 
    String(u.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(u.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              👥 User Management
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Create, edit, and revoke portal access for Regional Heads, Managers, and Admins.</p>
          </div>
          <button className="btn-action" onClick={() => setIsModalOpen(true)} style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>
            + Add New User
          </button>
        </div>

        <div style={{ marginBottom: '20px', maxWidth: '400px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
          <input 
            type="text" 
            placeholder="Search by name, role, or email..." 
            className="sleek-input" 
            style={{ width: '100%', paddingLeft: '45px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role & Access</th>
                <th>Scope (Course/Branch)</th>
                <th>Credentials</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>⏳ Fetching Users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>No users found matching your search.</td></tr>
              ) : (
                filteredUsers.map((user, i) => {
                  const accessLvl = String(user.access || '').toLowerCase();
                  return (
                    <tr key={i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontWeight: 'bold', border: '1px solid #0284c7' }}>
                            {user.userName ? String(user.userName).charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <span className="primary-text" style={{ fontSize: '1rem' }}>{user.userName || 'Unnamed User'}</span>
                            <span className="sub-text">{user.email || 'No Email'} • {user.contact || 'No Contact'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="primary-text">{user.role || 'Unassigned'}</span>
                        <span className={`badge ${accessLvl.includes('super') ? 'badge-blue' : accessLvl.includes('edit') ? 'badge-green' : ''}`} style={{ marginTop: '5px', background: accessLvl.includes('view only') ? 'rgba(245, 158, 11, 0.15)' : '', color: accessLvl.includes('view only') ? '#f59e0b' : '', border: accessLvl.includes('view only') ? '1px solid #f59e0b' : '' }}>
                          {user.access || 'View Only'}
                        </span>
                      </td>
                      <td>
                        <span className="primary-text">{user.course || 'All Courses'}</span>
                        <span className="sub-text">{user.assignedBranches || user.sittingBranch || 'Global Scope'}</span>
                      </td>
                      <td>
                        <span className="primary-text" style={{ fontFamily: 'monospace' }}>Login ID: {user.email || user.userName}</span>
                        <span className="sub-text" style={{ fontFamily: 'monospace' }}>Pass: {user.password}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDeleteUser(user.rowNumber, user.userName)}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', fontWeight: 'bold' }}
                          title="Delete User"
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="modal-card" style={{ maxWidth: '600px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>📋 Add New System User</h2>
              <span style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.5rem', fontWeight: 'bold' }} onClick={() => setIsModalOpen(false)}>✕</span>
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleAddUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" name="userName" value={formData.userName} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Login Mail ID</label>
                  <input type="text" name="email" value={formData.email} onChange={handleInputChange} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label>Contact Number</label>
                  <input type="text" name="contact" value={formData.contact} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="text" name="password" value={formData.password} onChange={handleInputChange} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label>Account Role</label>
                  <select name="role" value={formData.role} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }}>
                    <option value="Regional Technical Head">Regional Technical Head (RTH)</option>
                    <option value="Territory Technical Head">Territory Technical Head (TTH)</option>
                    <option value="Regional Manager">Regional Manager (RM)</option>
                    <option value="Territory Manager">Territory Manager (TM)</option>
                    <option value="Branch Manager">Branch Manager (BM)</option>
                    <option value="Technical Lead">Technical Lead (TL)</option>
                    <option value="TRAINER">Trainer</option>
                    <option value="General Manager">General Manager (Admin)</option>
                    <option value="Technical Head">Technical Head (Admin)</option>
                    <option value="Zonal Placement Head">Zonal Placement Head (Admin)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Access Permissions</label>
                  <select name="access" value={formData.access} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }}>
                    <option value="View Only">View Only</option>
                    <option value="View & Edit only">View & Edit</option>
                    <option value="SUPER ADMIN">SUPER ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Assigned Course (Required for RTH & TTH)</label>
                <select name="course" value={formData.course} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }}>
                  <option value="">-- Leave blank for Global Scope --</option>
                  <option value="BMS AND CCTV">BMS AND CCTV</option>
                  <option value="Industrial Automation">Industrial Automation</option>
                  <option value="Embedded and IoT">Embedded and IoT</option>
                  <option value="Digital Marketing">Digital Marketing</option>
                  <option value="Information technology (IT)">Information technology (IT)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '25px' }}>
                <label>Assigned Branches (Comma separated)</label>
                <input type="text" name="assignedBranches" placeholder="e.g. Calicut, Kannur, Palakkad" value={formData.assignedBranches} onChange={handleInputChange} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-action" style={{ width: 'auto' }} disabled={isSubmitting}>
                  {isSubmitting ? '⏳ Saving...' : 'Create User'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </Layout>
  );
}