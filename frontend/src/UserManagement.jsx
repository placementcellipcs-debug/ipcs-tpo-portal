import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Users, UserPlus, Trash, PencilSimple, CircleNotch, WarningCircle, X, Prohibit,
  CaretLeft, SquaresFour, List, IdentificationCard
} from '@phosphor-icons/react';
import Layout from './Layout';

// Colors for the Position Tiles
const TILE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#ef4444', '#f43f5e'];

// Master List of IPCS Branches for Dropdowns
const ALL_BRANCHES = [
  "Trivandrum", "Attingal", "Kollam", "Calicut", "Kannur", "Perinthalmanna", 
  "Palakkad", "Kochi", "Kottayam", "Thrissur", "Coimbatore", "Trichy", 
  "Salem", "Madurai", "Tirunelveli", "Tambaram", "Anna Nagar", "Chennai", 
  "Bangalore", "Mysore", "Mangalore", "Pune", "Mumbai", "Ramwadi", 
  "Nagpur", "Kolkata", "Bhopal", "Ranchi", "Global"
];

export default function UserManagement() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // View & Filtering States
  const [selectedRole, setSelectedRole] = useState(null); 
  const [viewType, setViewType] = useState('list');
  
  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  
  const initialFormState = {
    sheet: 'User', rowNumber: null, userName: '', email: '', contact: '', password: '', 
    role: 'Regional Technical Head', course: '', sittingBranch: '', 
    assignedBranches: [], access: 'View Only'
  };
  const [formData, setFormData] = useState(initialFormState);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('https://api-talenzo.ipcsglobal.info/api/admin/users');
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

  const toggleBranchSelection = (branch) => {
    setFormData(prev => {
      const isSelected = prev.assignedBranches.includes(branch);
      if (isSelected) {
        return { ...prev, assignedBranches: prev.assignedBranches.filter(b => b !== branch) };
      } else {
        return { ...prev, assignedBranches: [...prev.assignedBranches, branch] };
      }
    });
  };

  const openAddModal = () => {
    setFormData(initialFormState);
    setIsEditMode(false);
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setFormData({
      sheet: user.sheet,
      rowNumber: user.rowNumber,
      userName: user.userName,
      email: user.email,
      contact: user.contact,
      password: user.password,
      role: user.role,
      course: user.course,
      sittingBranch: user.sittingBranch,
      assignedBranches: user.assignedBranches ? user.assignedBranches.split(',').map(b => b.trim()) : [],
      access: user.access
    });
    setIsEditMode(true);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const payload = {
      ...formData,
      assignedBranches: formData.assignedBranches.join(', ')
    };

    try {
      const endpoint = isEditMode 
        ? 'https://api-talenzo.ipcsglobal.info/api/admin/users/update' 
        : 'https://api-talenzo.ipcsglobal.info/api/admin/users/add';
        
      const res = await axios.post(endpoint, payload);
      if (res.data.success) {
        setIsModalOpen(false);
        setLoading(true);
        fetchUsers(); 
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'add'} user.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (sheet, rowNumber, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete user: ${userName}?`)) return;
    try {
      const res = await axios.post('https://api-talenzo.ipcsglobal.info/api/admin/users/delete', { sheet, rowNumber });
      if (res.data.success) {
        setUsers(users.filter(u => u.rowNumber !== rowNumber || u.sheet !== sheet));
      }
    } catch (err) {
      alert("Failed to delete user.");
    }
  };

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };

  // Safe Fallback for non-Super Admins
  if (tpoData?.accessType !== 'superadmin') {
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', textAlign: 'center' }}>
          <Prohibit size={64} color="#ef4444" weight="fill" style={{ marginBottom: '20px' }} />
          <h2>Access Denied</h2>
          <p>You do not have Super Admin privileges to view this page.</p>
        </div>
      </Layout>
    );
  }

  // ==========================================
  // DATA PREP FOR TILES & DIRECTORY
  // ==========================================
  
  // 1. Remove the logged-in super admin from the array so they don't see/edit themselves
  const validUsers = (users || []).filter(u => String(u.email || '').toLowerCase() !== String(tpoData.email).toLowerCase());

  // 2. Count users per Position/Role
  const roleData = {};
  validUsers.forEach(u => {
    const r = u.role || 'Unassigned';
    roleData[r] = (roleData[r] || 0) + 1;
  });
  const roleList = Object.keys(roleData).sort();

  // 3. Filter data for the specific directory view
  const activeUsers = selectedRole ? validUsers.filter(u => (u.role || 'Unassigned') === selectedRole) : [];
  const filteredUsers = activeUsers.filter(u => 
    String(u.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {/* ========================================== */}
        {/* VIEW 1: LANDING PAGE - POSITION TILES */}
        {/* ========================================== */}
        {!selectedRole ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Users color="var(--accent-primary)" weight="fill" /> User Management
                </h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select a position below to view and manage assigned staff members.</p>
              </div>
              <button className="btn-action" onClick={openAddModal} style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>
                <UserPlus size={20} weight="bold" /> Add New User
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--accent-primary)' }}><CircleNotch size={40} className="ph-spin" /><p>Fetching portal users...</p></div>
            ) : roleList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>No other users exist in the system yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
                {roleList.map((role, index) => {
                  const color = TILE_COLORS[index % TILE_COLORS.length];
                  return (
                    <div 
                      key={role} 
                      onClick={() => setSelectedRole(role)}
                      style={{ backgroundColor: color, borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
                    >
                      <h2 style={{ color: '#ffffff', fontSize: '1.8rem', margin: '0 0 15px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)', lineHeight: 1.2 }}>{role}</h2>
                      <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={20} color="#ffffff" weight="bold" />
                        <span style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 'bold' }}>{roleData[role]} Users</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* ========================================== */
          /* VIEW 2: DIRECTORY DETAILS FOR SELECTED ROLE */
          /* ========================================== */
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => setSelectedRole(null)} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CaretLeft weight="bold" size={18} /> Back to Roles
                </button>
                <div>
                  <h1 style={{ fontSize: '1.8rem', margin: 0 }}>{selectedRole} Directory</h1>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage access, reset passwords, or remove personnel.</p>
                </div>
              </div>
              <button className="btn-action" onClick={openAddModal} style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>
                <UserPlus size={20} weight="bold" /> Add New User
              </button>
            </div>

            <div className="header-controls">
              <div className="filter-group" style={{ position: 'relative', width: '300px' }}>
                <input 
                  type="text" 
                  className="sleek-input" 
                  placeholder={`Search ${selectedRole}s by name or email...`} 
                  style={{ width: '100%' }}
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>
              <div className="view-toggles">
                <button className={`view-btn ${viewType === 'grid' ? 'active' : ''}`} onClick={() => setViewType('grid')}><SquaresFour weight="fill" /></button>
                <button className={`view-btn ${viewType === 'list' ? 'active' : ''}`} onClick={() => setViewType('list')}><List weight="bold" /></button>
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>No users found for this position.</div>
            ) : viewType === 'grid' ? (
              <div className="student-grid">
                {filteredUsers.map((user, i) => {
                  const accessLvl = String(user.access || '').toLowerCase();
                  const photoUrl = getDriveImage(user.profilePhoto);
                  const initial = user.userName ? String(user.userName).charAt(0).toUpperCase() : '?';

                  return (
                    <div className="student-card" key={i}>
                      <div className="sc-avatar" style={{ border: 'none', background: 'var(--accent-primary)', color: '#0f172a' }}>
                        {photoUrl ? (
                          <img 
                            src={photoUrl} alt={user.userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            onError={(e) => { e.target.style.display='none'; e.target.parentNode.innerHTML = `<span style="font-size: 1.5rem; font-weight: bold;">${initial}</span>`; }} 
                          />
                        ) : initial}
                      </div>
                      <div className="sc-name">{user.userName || 'Unnamed User'}</div>
                      <div className="sc-roll" style={{ textTransform: 'none', color: 'var(--text-muted)' }}>{user.email || 'No Email'}</div>
                      
                      <div className="sc-details" style={{ marginTop: '10px' }}>
                        <div className="sc-detail-row"><span>Access</span><strong style={{ color: accessLvl.includes('super') ? '#38bdf8' : accessLvl.includes('edit') ? '#10b981' : '#f59e0b' }}>{user.access || 'View Only'}</strong></div>
                        <div className="sc-detail-row"><span>Course</span><strong style={{ color: 'var(--text-main)' }}>{user.course === 'All Courses' ? 'Global Scope' : user.course}</strong></div>
                        <div className="sc-detail-row"><span>Branches</span><strong style={{ color: 'var(--text-main)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.assignedBranches}>{user.assignedBranches || 'Global'}</strong></div>
                        <div className="sc-detail-row"><span>Password</span><strong style={{ color: 'var(--text-main)' }}>{user.password}</strong></div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                        <button className="btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }} onClick={() => openEditModal(user)}>
                          <PencilSimple weight="bold"/> Edit
                        </button>
                        <button className="btn-secondary" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }} onClick={() => handleDeleteUser(user.sheet, user.rowNumber, user.userName)}>
                          <Trash weight="bold"/> Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>User Details</th>
                      <th>Access Level</th>
                      <th>Scope (Course/Branch)</th>
                      <th>Credentials</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, i) => {
                      const accessLvl = String(user.access || '').toLowerCase();
                      const photoUrl = getDriveImage(user.profilePhoto);
                      const initial = user.userName ? String(user.userName).charAt(0).toUpperCase() : '?';

                      return (
                        <tr key={i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontWeight: 'bold', border: '1px solid #0284c7', overflow: 'hidden', flexShrink: 0 }}>
                                {photoUrl ? (
                                  <img 
                                    src={photoUrl} alt={user.userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    onError={(e) => { e.target.style.display='none'; e.target.parentNode.innerHTML = `<span style="font-size: 1rem; font-weight: bold;">${initial}</span>`; }} 
                                  />
                                ) : initial}
                              </div>
                              <div>
                                <span className="primary-text" style={{ fontSize: '1rem' }}>{user.userName || 'Unnamed User'}</span>
                                <span className="sub-text">{user.email || 'No Email'} • {user.contact || 'No Contact'}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${accessLvl.includes('super') ? 'badge-blue' : accessLvl.includes('edit') ? 'badge-green' : ''}`} style={{ background: accessLvl.includes('view only') ? 'rgba(245, 158, 11, 0.15)' : '', color: accessLvl.includes('view only') ? '#f59e0b' : '', border: accessLvl.includes('view only') ? '1px solid #f59e0b' : '' }}>
                              {user.access || 'View Only'}
                            </span>
                          </td>
                          <td>
                            <span className="primary-text">{user.course || 'Global Scope'}</span>
                            <span className="sub-text" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.assignedBranches || user.sittingBranch}>{user.assignedBranches || user.sittingBranch || 'Global Scope'}</span>
                          </td>
                          <td>
                            <span className="primary-text" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>ID: {user.email || user.userName}</span>
                            <span className="sub-text" style={{ fontFamily: 'monospace' }}>Pass: {user.password}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button 
                                onClick={() => openEditModal(user)}
                                style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid #0284c7', padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
                                title="Edit User"
                              >
                                <PencilSimple size={18} weight="bold" />
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(user.sheet, user.rowNumber, user.userName)}
                                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
                                title="Delete User"
                              >
                                <Trash size={18} weight="bold" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ========================================== */}
      {/* UNIVERSAL ADD/EDIT MODAL OVERLAY */}
      {/* ========================================== */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="modal-card" style={{ maxWidth: '650px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isEditMode ? <PencilSimple color="var(--accent-primary)" /> : <UserPlus color="var(--accent-primary)" />} 
                {isEditMode ? 'Edit System User' : 'Add New System User'}
              </h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsModalOpen(false)} />
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <WarningCircle size={20} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
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
                  <select name="role" value={formData.role} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }} disabled={formData.sheet === 'Contact'}>
                    <option value="TPO">Placement Officer (TPO)</option>
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
                  <select name="access" value={formData.access} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }} disabled={formData.sheet === 'Contact'}>
                    <option value="View Only">View Only</option>
                    <option value="View & Edit">View & Edit</option>
                    <option value="SUPER ADMIN">SUPER ADMIN</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label>Assigned Course (Required for RTH & TTH)</label>
                  <select name="course" value={formData.course} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }} disabled={formData.sheet === 'Contact'}>
                    <option value="">-- All Courses --</option>
                    <option value="BMS AND CCTV">BMS AND CCTV</option>
                    <option value="Industrial Automation">Industrial Automation</option>
                    <option value="Embedded and IoT">Embedded and IoT</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Information technology (IT)">Information technology (IT)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sitting Branch</label>
                  <select name="sittingBranch" value={formData.sittingBranch} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }}>
                    <option value="">-- Select Sitting Branch --</option>
                    {ALL_BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '25px', position: 'relative' }}>
                <label>Assigned Branches</label>
                <div 
                  className="sleek-input" 
                  style={{ width: '100%', minHeight: '45px', cursor: 'pointer', display: 'flex', alignItems: 'center', background: 'var(--input-bg)', flexWrap: 'wrap', gap: '5px' }}
                  onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                >
                  {formData.assignedBranches.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>Select branches...</span> : formData.assignedBranches.map(b => (
                    <span key={b} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid #0284c7' }}>{b}</span>
                  ))}
                </div>

                {isBranchDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', marginTop: '5px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', padding: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                    {ALL_BRANCHES.map(branch => (
                      <label key={branch} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', cursor: 'pointer', textTransform: 'none', color: 'var(--text-main)', fontWeight: 'normal', margin: 0, borderRadius: '4px' }}>
                        <input 
                          type="checkbox" 
                          style={{ width: 'auto' }}
                          checked={formData.assignedBranches.includes(branch)}
                          onChange={() => toggleBranchSelection(branch)}
                        />
                        {branch}
                      </label>
                    ))}
                    <button type="button" onClick={() => setIsBranchDropdownOpen(false)} style={{ width: '100%', background: 'var(--accent-primary)', color: '#000', border: 'none', padding: '8px', borderRadius: '6px', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Done</button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-action" style={{ width: 'auto' }} disabled={isSubmitting}>
                  {isSubmitting ? <CircleNotch size={20} className="ph-spin" /> : (isEditMode ? 'Save Changes' : 'Create User')}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </Layout>
  );
}