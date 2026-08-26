import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Plus, PencilSimple, X, FloppyDisk } from '@phosphor-icons/react';
import Layout from './Layout';

export default function PlacedStudents() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Search
  const [monthFilter, setMonthFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);

  // Form States (Includes file object)
  const [editForm, setEditForm] = useState({});
  const [addForm, setAddForm] = useState({ 
    name: '', phone: '', email: '', roll: '', course: '', branch: '', 
    company: '', position: '', status: 'Placed', remarks: '', 
    datePlaced: new Date().toISOString().split('T')[0], packageLpa: '', joiningStatus: '', offerLetterFile: null 
  });

  useEffect(() => {
    if (!tpoData) return;
    fetchData();
  }, [tpoData]);

  const fetchData = async () => {
    try {
      const response = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications', { 
        assignedBranchesArray: tpoData.assignedBranchesArray, tpoName: tpoData.name, role: tpoData.role, assignedCourse: tpoData.assignedCourse
      });
      if (response.data.success) setApplications(response.data.applications);
    } catch (error) { console.error("Failed to load", error); } finally { setLoading(false); }
  };

  // 🚨 FILTER & SORT - Now smartly catches all placement variations
  const placedApps = applications.filter(a => {
    const s = (a.status || '').toLowerCase();
    const j = (a.joiningStatus || '').toLowerCase();
    const isPlaced = s.includes('placed') || s.includes('got offer') || s.includes('join') || s.includes('offer') || j.includes('join');
    
    let dateObj = new Date(a.datePlaced || a.date);
    let monthKey = !isNaN(dateObj) ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : '';
    let mMatch = monthFilter ? monthKey === monthFilter : true;
    let sMatch = searchQuery === '' || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.company.toLowerCase().includes(searchQuery.toLowerCase()) || (a.roll || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    return isPlaced && mMatch && sMatch;
  }).sort((a, b) => {
    if(sortOrder === 'newest') return new Date(b.datePlaced || b.date) - new Date(a.datePlaced || a.date);
    if(sortOrder === 'az') return a.name.localeCompare(b.name);
    if(sortOrder === 'za') return b.name.localeCompare(a.name);
    return 0;
  });

  const openEditModal = (app) => {
    setSelectedApp(app);
    setEditForm({
      remarks: app.remarks, datePlaced: app.datePlaced, 
      packageLpa: app.packageLpa, offerLetterFile: null, joiningStatus: app.joiningStatus
    });
    setIsEditModalOpen(true);
  };

  const submitEdit = async () => {
    setSavingStatus(true);
    try {
      const formData = new FormData();
      formData.append('rowNumber', selectedApp.rowNumber);
      formData.append('fullApp', JSON.stringify(selectedApp));
      formData.append('status', selectedApp.status); 
      formData.append('remarks', editForm.remarks || '');
      formData.append('datePlaced', editForm.datePlaced || '');
      formData.append('packageLpa', editForm.packageLpa || '');
      formData.append('joiningStatus', editForm.joiningStatus || '');
      
      if (editForm.offerLetterFile) formData.append('offerLetterFile', editForm.offerLetterFile);

      await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications/update', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) { alert("Failed to save."); } finally { setSavingStatus(false); }
  };

  const submitAdd = async () => {
    if(!addForm.roll || !addForm.name || !addForm.company) return alert("Roll Number, Name, and Company are required.");
    setSavingStatus(true);
    try {
      const formData = new FormData();
      formData.append('tpoName', tpoData.name);
      formData.append('appData', JSON.stringify(addForm));
      
      if (addForm.offerLetterFile) formData.append('offerLetterFile', addForm.offerLetterFile);

      await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications/add', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      setIsAddModalOpen(false);
      setAddForm({ name: '', phone: '', email: '', roll: '', course: '', branch: '', company: '', position: '', status: 'Placed', remarks: '', datePlaced: new Date().toISOString().split('T')[0], packageLpa: '', joiningStatus: '', offerLetterFile: null });
      fetchData();
    } catch (error) { alert("Failed to add."); } finally { setSavingStatus(false); }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Placed Students Data</h1>
            <p style={{ color: 'var(--text-muted)' }}>Manage placement details, upload offer letters directly to Drive, and log salary packages.</p>
          </div>
          <button className="btn-action" style={{ background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', width: 'auto' }} onClick={() => setIsAddModalOpen(true)}>
            <Plus weight="bold" /> Add Placement
          </button>
        </div>
        
        <div className="header-controls" style={{ justifyContent: 'flex-start' }}>
          <input type="text" className="sleek-input" placeholder="Search student or company..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <input type="month" className="sleek-input" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          <select className="sleek-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="newest">Sort: Date Placed</option>
            <option value="az">Sort: Student A-Z</option>
            <option value="za">Sort: Student Z-A</option>
          </select>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '3rem', color: '#10b981' }}><CircleNotch size={40} className="ph-spin" /><p>Loading records...</p></div>
          ) : placedApps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>No placed students found matching filters.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 2fr 0.5fr', padding: '0 1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px' }}>
                <span>STUDENT DETAILS</span><span>COMPANY & POSITION</span><span>PLACED DATE & LPA</span><span>STATUS & OFFER</span><span style={{textAlign:'center'}}>ACTION</span>
              </div>

              {placedApps.map(app => (
                <div key={app.rowNumber} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 2fr 0.5fr', alignItems: 'center', gap: '15px' }}>
                  
                  <div>
                    <strong style={{ display: 'block', color: '#fff', fontSize: '1.05rem', marginBottom: '4px' }}>{app.name}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• {app.branch}</span>
                  </div>

                  <div>
                    <strong style={{ display: 'block', color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>{app.company}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{app.position || 'Position N/A'}</span>
                  </div>

                  <div>
                    <strong style={{ display: 'block', color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>{app.datePlaced ? new Date(app.datePlaced).toLocaleDateString('en-GB') : 'N/A'}</strong>
                    <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>{app.packageLpa ? `${app.packageLpa} LPA` : 'N/A LPA'}</span>
                  </div>

                  <div>
                    <span style={{ border: '1px solid #10b981', color: '#10b981', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px' }}>{app.status.toUpperCase()}</span>
                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>{app.joiningStatus || 'Joining TBD'}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', gap: '6px' }} onClick={() => openEditModal(app)}>
                      <PencilSimple weight="bold" size={14} /> Edit
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isEditModalOpen && selectedApp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsEditModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Update {selectedApp.name}'s Placement</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsEditModalOpen(false)} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div><label className="data-label">Date Placed</label><input type="date" className="sleek-input" style={{width:'100%'}} value={editForm.datePlaced} onChange={e=>setEditForm({...editForm, datePlaced: e.target.value})} /></div>
              <div><label className="data-label">Package (LPA)</label><input type="number" step="0.1" className="sleek-input" placeholder="e.g. 4.5" style={{width:'100%'}} value={editForm.packageLpa} onChange={e=>setEditForm({...editForm, packageLpa: e.target.value})} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div><label className="data-label">Joining Status</label><select className="sleek-select" style={{width:'100%'}} value={editForm.joiningStatus} onChange={e=>setEditForm({...editForm, joiningStatus: e.target.value})}><option value="">Select...</option><option value="Joined">Joined</option><option value="Not Joined">Not Joined</option></select></div>
              <div>
                <label className="data-label">Upload Offer Letter</label>
                <input type="file" className="sleek-input" style={{width:'100%', padding: '6px'}} onChange={e=>setEditForm({...editForm, offerLetterFile: e.target.files[0]})} />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="data-label">Remarks</label>
              <input type="text" className="sleek-input" placeholder="Add remarks..." style={{width:'100%'}} value={editForm.remarks} onChange={e=>setEditForm({...editForm, remarks: e.target.value})} />
            </div>

            <button className="btn-action" style={{ background: '#10b981', color: '#fff', width: '100%' }} onClick={submitEdit} disabled={savingStatus}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Save Updates</>}
            </button>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsAddModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Add Manual Placement</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsAddModalOpen(false)} />
            </div>
            
            <h3 style={{ fontSize: '0.85rem', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '10px' }}>Student Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div><label className="data-label">Student Name *</label><input type="text" className="sleek-input" style={{width:'100%'}} value={addForm.name} onChange={e=>setAddForm({...addForm, name: e.target.value})} /></div>
              <div><label className="data-label">Roll Number *</label><input type="text" className="sleek-input" style={{width:'100%'}} value={addForm.roll} onChange={e=>setAddForm({...addForm, roll: e.target.value})} /></div>
              <div><label className="data-label">Contact No.</label><input type="text" className="sleek-input" style={{width:'100%'}} value={addForm.phone} onChange={e=>setAddForm({...addForm, phone: e.target.value})} /></div>
              <div><label className="data-label">Mail ID</label><input type="text" className="sleek-input" style={{width:'100%'}} value={addForm.email} onChange={e=>setAddForm({...addForm, email: e.target.value})} /></div>
              <div><label className="data-label">Course</label><input type="text" className="sleek-input" style={{width:'100%'}} value={addForm.course} onChange={e=>setAddForm({...addForm, course: e.target.value})} /></div>
              <div><label className="data-label">Branch</label><input type="text" className="sleek-input" style={{width:'100%'}} value={addForm.branch} onChange={e=>setAddForm({...addForm, branch: e.target.value})} /></div>
            </div>

            <h3 style={{ fontSize: '0.85rem', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '10px' }}>Placement Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div><label className="data-label">Company Name *</label><input type="text" className="sleek-input" style={{width:'100%'}} value={addForm.company} onChange={e=>setAddForm({...addForm, company: e.target.value})} /></div>
              <div><label className="data-label">Position Status</label><input type="text" className="sleek-input" style={{width:'100%'}} value={addForm.position} onChange={e=>setAddForm({...addForm, position: e.target.value})} /></div>
              <div><label className="data-label">Date Placed</label><input type="date" className="sleek-input" style={{width:'100%'}} value={addForm.datePlaced} onChange={e=>setAddForm({...addForm, datePlaced: e.target.value})} /></div>
              <div><label className="data-label">Package (LPA)</label><input type="number" step="0.1" className="sleek-input" style={{width:'100%'}} value={addForm.packageLpa} onChange={e=>setAddForm({...addForm, packageLpa: e.target.value})} /></div>
              <div><label className="data-label">Joining Status</label><select className="sleek-select" style={{width:'100%'}} value={addForm.joiningStatus} onChange={e=>setAddForm({...addForm, joiningStatus: e.target.value})}><option value="">Select...</option><option value="Joined">Joined</option><option value="Not Joined">Not Joined</option></select></div>
              <div><label className="data-label">Upload Offer Letter</label><input type="file" className="sleek-input" style={{width:'100%', padding:'6px'}} onChange={e=>setAddForm({...addForm, offerLetterFile: e.target.files[0]})} /></div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}><label className="data-label">Remarks</label><input type="text" className="sleek-input" style={{width:'100%'}} value={addForm.remarks} onChange={e=>setAddForm({...addForm, remarks: e.target.value})} /></div>

            <button className="btn-action" style={{ background: '#10b981', color: '#fff', width: '100%' }} onClick={submitAdd} disabled={savingStatus}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Save New Placement</>}
            </button>
          </div>
        </div>
      )}

    </Layout>
  );
}