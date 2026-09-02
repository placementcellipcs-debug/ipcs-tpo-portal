import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, Plus, PencilSimple, X, FloppyDisk, 
  CaretLeft, Trophy, ArrowsClockwise 
} from '@phosphor-icons/react';
import Layout from './Layout';

const TILE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9', '#f43f5e'];

const getStandardCourse = (c) => {
  if (!c) return 'Others';
  const lower = c.toLowerCase().trim();
  if (lower.includes('bms') || lower.includes('cctv')) return 'BMS AND CCTV';
  if (lower.includes('automation') || lower.includes('plc') || lower.includes('scada')) return 'Industrial Automation';
  if (lower.includes('embed') || lower.includes('iot')) return 'Embedded and IoT';
  if (lower.includes('digital') || lower.includes('dm') || lower.includes('marketing')) return 'Digital Marketing';
  if (lower.includes('it') || lower.includes('python') || lower.includes('software') || lower.includes('data')) return 'Information technology (IT)';
  return 'Others';
};

const parseDate = (dStr) => {
  if (!dStr) return null;
  let cleanStr = typeof dStr === 'string' ? dStr.split(' ')[0] : dStr;
  if (typeof cleanStr === 'string' && cleanStr.includes('/')) {
    const parts = cleanStr.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    }
  }
  const d = new Date(cleanStr);
  return isNaN(d) ? null : d;
};

export default function PlacedStudents() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🚨 RESTRICT ADD PLACEMENT BUTTON
  const upperRole = (tpoData?.role || '').toUpperCase();
  const isTpo = upperRole === 'TPO';
  const isSuper = (tpoData?.accessType === 'superadmin') || upperRole.includes('GENERAL MANAGER') || upperRole.includes('ZONAL PLACEMENT HEAD') || upperRole === 'TECHNICAL HEAD';
  const canAddPlacement = isTpo || isSuper;

  // 🚨 RESTRICT DATA BY COURSE
  const isCourseSpecific = upperRole.includes('RTH') || upperRole.includes('TTH') || upperRole.includes('TRAINER') || upperRole.includes('TECHNICAL LEAD');
  const displayCourse = tpoData?.assignedCourse || '';
  
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const [editForm, setEditForm] = useState({});
  const [addForm, setAddForm] = useState({ 
    name: '', phone: '', email: '', roll: '', course: 'Industrial Automation', branch: '', 
    company: '', position: '', status: 'Placed', remarks: '', 
    datePlaced: new Date().toISOString().split('T')[0], packageLpa: '', joiningStatus: 'Joined', offerLetterFile: null 
  });

  const fetchData = async () => {
    const localTpoStr = localStorage.getItem('tpoData');
    if (!localTpoStr) return;
    const localTpo = JSON.parse(localTpoStr);
    const payload = { 
      assignedBranchesArray: localTpo.assignedBranchesArray, 
      tpoName: localTpo.name, 
      role: localTpo.role, 
      assignedCourse: localTpo.assignedCourse 
    };

    try {
      setLoading(true);
      const [appRes, repRes] = await Promise.all([
        axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications', payload),
        axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/reports', payload)
      ]);

      if (repRes.data.success) {
        let logs = repRes.data.tpoLogs || [];

        const isSuperUser = localTpo.accessType === 'superadmin' || localTpo.assignedBranchesArray.includes('all');
        if (!isSuperUser) {
          logs = logs.filter(log => {
            const b = (log['Branch'] || '').toLowerCase();
            return localTpo.assignedBranchesArray.some(assigned => b.includes(assigned) || assigned.includes(b));
          });
        }

        let mappedLogs = logs.map(row => ({
          name: row['Student Name'] || '', phone: row['Contact'] || '', email: row['Mail ID'] || '',
          roll: row['Roll Number'] || '', course: row['Course'] || '', branch: row['Branch'] || '',
          qual: row['Qualification'] || '', company: row['Company Name'] || '', position: row['Position'] || '',
          status: row['Status'] || 'Placed', remarks: row['Remarks'] || '', datePlaced: row['DATE PLACED'] || row['TimeStamp'] || '',
          packageLpa: row['PACKAGE (LPA)'] || '', joiningStatus: row['Joining Status'] || '',
          offerLetter: row['Offer Letter Status'] || row['Offer Letter'] || '', tpoName: row['Placement Officer'] || ''
        }));

        mappedLogs = mappedLogs.filter(a => {
          const s = (a.status || '').toLowerCase();
          const j = (a.joiningStatus || '').toLowerCase();
          return s.includes('placed') || s.includes('got offer') || s.includes('join') || s.includes('offer') || j.includes('join');
        });

        const deduped = {};
        mappedLogs.forEach(log => {
          const key = `${log.roll || log.name}_${log.company}`.toLowerCase();
          deduped[key] = log; 
        });

        let finalApps = Object.values(deduped);

        if (appRes.data.success) {
          finalApps = finalApps.map(logApp => {
            const match = appRes.data.applications.find(a => 
              (a.roll === logApp.roll || a.name === logApp.name) && a.company === logApp.company
            );
            return { ...logApp, rowNumber: match ? match.rowNumber : null };
          });
        }

        setApplications(finalApps);
      }
    } catch (error) { 
      console.error("Failed to load placed applications", error); 
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const resetFilters = () => {
    setSearchQuery(''); setCourseFilter('All'); setMonthFilter(''); setSortOrder('newest');
  };

  const globallyFiltered = applications.filter(a => {
    // 🚨 Strict Course Restriction for specific roles
    if (isCourseSpecific && getStandardCourse(a.course) !== getStandardCourse(displayCourse)) return false;

    let cMatch = courseFilter === 'All' || getStandardCourse(a.course) === getStandardCourse(courseFilter);
    let dateObj = parseDate(a.datePlaced || a.date);
    let monthKey = dateObj ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : '';
    let mMatch = monthFilter === '' ? true : monthKey === monthFilter;
    return cMatch && mMatch;
  });

  const branchData = {};
  globallyFiltered.forEach(a => {
    const b = a.branch || 'Unknown';
    branchData[b] = (branchData[b] || 0) + 1;
  });
  const branchList = Object.keys(branchData).sort();

  const activePlacedApps = selectedBranch ? globallyFiltered.filter(a => a.branch === selectedBranch) : [];

  const filteredApps = activePlacedApps.filter(a => {
    return searchQuery === '' || 
      (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (a.company || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (a.roll || '').toLowerCase().includes(searchQuery.toLowerCase());
  }).sort((a, b) => {
    if (sortOrder === 'newest') return (parseDate(b.datePlaced) || 0) - (parseDate(a.datePlaced) || 0);
    if (sortOrder === 'az') return (a.name || '').localeCompare(b.name || '');
    if (sortOrder === 'za') return (b.name || '').localeCompare(a.name || '');
    return 0;
  });

  const openEditModal = (app) => {
    if (!app.rowNumber) {
      alert("Cannot edit this log because it does not exist in the active Opening_Applied sheet.");
      return;
    }
    setSelectedApp(app);
    setEditForm({ remarks: app.remarks, datePlaced: app.datePlaced, packageLpa: app.packageLpa, offerLetterFile: null, joiningStatus: app.joiningStatus });
    setIsEditModalOpen(true);
  };

  const submitEdit = async () => {
    setSavingStatus(true);
    try {
      const formData = new FormData();
      formData.append('rowNumber', selectedApp.rowNumber);
      formData.append('fullApp', JSON.stringify(selectedApp));
      formData.append('status', selectedApp.status || 'Placed'); 
      formData.append('remarks', editForm.remarks || '');
      formData.append('datePlaced', editForm.datePlaced || '');
      formData.append('packageLpa', editForm.packageLpa || '');
      formData.append('joiningStatus', editForm.joiningStatus || '');
      if (editForm.offerLetterFile) formData.append('offerLetterFile', editForm.offerLetterFile);

      await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications/update', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) { alert("Failed to save placement updates."); } finally { setSavingStatus(false); }
  };

  const submitAdd = async () => {
    if (!addForm.roll || !addForm.name || !addForm.company) return alert("Student Name, Roll Number, and Company Name are required.");
    setSavingStatus(true);
    try {
      const formData = new FormData();
      formData.append('tpoName', tpoData?.name || 'Admin');
      formData.append('appData', JSON.stringify(addForm));
      if (addForm.offerLetterFile) formData.append('offerLetterFile', addForm.offerLetterFile);

      await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications/add', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      setIsAddModalOpen(false);
      setAddForm({ name: '', phone: '', email: '', roll: '', course: 'Industrial Automation', branch: '', company: '', position: '', status: 'Placed', remarks: '', datePlaced: new Date().toISOString().split('T')[0], packageLpa: '', joiningStatus: 'Joined', offerLetterFile: null });
      fetchData();
    } catch (error) { alert("Failed to add placement."); } finally { setSavingStatus(false); }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            {selectedBranch ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => setSelectedBranch(null)} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CaretLeft weight="bold" size={18} /> Back to Branches
                </button>
                <div>
                  <h1 style={{ fontSize: '1.8rem', margin: 0 }}>{selectedBranch} Placements</h1>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Data sourced directly from TPO_Log</p>
                </div>
              </div>
            ) : (
              <div>
                <h1 style={{ fontSize: '2rem', marginBottom: '5px' }}>Placed Students Data</h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Filter by Course and Month/Year across all branches.</p>
              </div>
            )}
          </div>
          
          {canAddPlacement && (
            <button className="btn-action" style={{ background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', width: 'auto' }} onClick={() => setIsAddModalOpen(true)}>
              <Plus weight="bold" /> Add Placement
            </button>
          )}
        </div>

        <div className="header-controls" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center', background: 'var(--card-bg)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
          {selectedBranch && (
            <input type="text" className="sleek-input" placeholder="Search student, roll, or company..." style={{ minWidth: '220px', flex: 1 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          )}

          {/* 🚨 Course Filter Hidden for Course-Specific Roles */}
          {!isCourseSpecific && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Course:</span>
              <select className="sleek-select" style={{ minWidth: '190px' }} value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                <option value="All">All Main Courses</option>
                <option value="Industrial Automation">Industrial Automation</option>
                <option value="BMS AND CCTV">BMS AND CCTV</option>
                <option value="Embedded and IoT">Embedded and IoT</option>
                <option value="Digital Marketing">Digital Marketing</option>
                <option value="Information technology (IT)">Information technology (IT)</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Month/Year:</span>
            <input type="month" className="sleek-input" style={{ minWidth: '150px' }} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          </div>

          {selectedBranch && (
            <select className="sleek-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="newest">Sort: Date Placed</option>
              <option value="az">Sort: Student A-Z</option>
              <option value="za">Sort: Student Z-A</option>
            </select>
          )}

          {(courseFilter !== 'All' || monthFilter !== '' || searchQuery !== '') && (
            <button onClick={resetFilters} style={{ background: 'transparent', border: '1px solid #64748b', color: '#94a3b8', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
              <ArrowsClockwise size={14} /> Reset
            </button>
          )}
        </div>

        {/* CONTENT AREA */}
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: '#10b981' }}>
            <CircleNotch size={50} className="ph-spin" />
            <p style={{ marginTop: '10px', color: 'var(--text-muted)' }}>Loading records from TPO_Log...</p>
          </div>
        ) : !selectedBranch ? (
          branchList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', margin: 0 }}>No placed students matched the selected course/month filters.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px', marginTop: '15px' }}>
              {branchList.map((branch, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <div key={branch} onClick={() => setSelectedBranch(branch)} style={{ backgroundColor: color, borderRadius: '20px', padding: '35px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                    <h2 style={{ color: '#ffffff', fontSize: '2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{branch}</h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Trophy size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 'bold' }}>{branchData[branch]} Placed</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div style={{ marginTop: '1.5rem' }}>
            {filteredApps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                No placed students found in {selectedBranch} matching these filters.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 2fr 0.5fr', padding: '0 1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px' }}>
                  <span>STUDENT DETAILS</span><span>COMPANY & POSITION</span><span>PLACED DATE & LPA</span><span>STATUS & JOINING</span><span style={{ textAlign: 'center' }}>ACTION</span>
                </div>

                {filteredApps.map((app, i) => (
                  <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 2fr 0.5fr', alignItems: 'center', gap: '15px' }}>
                    <div>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '1.05rem', marginBottom: '4px' }}>{app.name}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{app.roll || 'No Roll #'} • {app.course}</span>
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>{app.company}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{app.position || 'Position N/A'}</span>
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>
                        {app.datePlaced ? (app.datePlaced.includes('/') ? app.datePlaced.split(' ')[0] : new Date(app.datePlaced).toLocaleDateString('en-GB')) : 'N/A'}
                      </strong>
                      <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>{app.packageLpa ? `${app.packageLpa} LPA` : 'N/A LPA'}</span>
                    </div>
                    <div>
                      <span style={{ border: '1px solid #10b981', color: '#10b981', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {(app.status || 'Placed').toUpperCase()}
                      </span>
                      <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px' }}>{app.joiningStatus || 'Joined'}</span>
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
        )}
      </div>

      {/* EDIT PLACEMENT MODAL */}
      {isEditModalOpen && selectedApp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsEditModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '1.4rem' }}>Update {selectedApp.name}'s Placement</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsEditModalOpen(false)} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label className="data-label">Date Placed</label>
                <input type="date" className="sleek-input" style={{ width: '100%' }} value={editForm.datePlaced || ''} onChange={e => setEditForm({...editForm, datePlaced: e.target.value})} />
              </div>
              <div>
                <label className="data-label">Package (LPA)</label>
                <input type="number" step="0.1" className="sleek-input" placeholder="e.g. 4.5" style={{ width: '100%' }} value={editForm.packageLpa || ''} onChange={e => setEditForm({...editForm, packageLpa: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label className="data-label">Joining Status</label>
                <select className="sleek-select" style={{ width: '100%' }} value={editForm.joiningStatus || 'Joined'} onChange={e => setEditForm({...editForm, joiningStatus: e.target.value})}>
                  <option value="Joined">Joined</option>
                  <option value="Not Joined">Not Joined</option>
                  <option value="Pending Joining">Pending Joining</option>
                </select>
              </div>
              <div>
                <label className="data-label">Upload Offer Letter</label>
                <input type="file" className="sleek-input" style={{ width: '100%', padding: '6px' }} onChange={e => setEditForm({...editForm, offerLetterFile: e.target.files[0]})} />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="data-label">Remarks</label>
              <input type="text" className="sleek-input" placeholder="Add remarks..." style={{ width: '100%' }} value={editForm.remarks || ''} onChange={e => setEditForm({...editForm, remarks: e.target.value})} />
            </div>

            <button className="btn-action" style={{ background: '#10b981', color: '#fff', width: '100%' }} onClick={submitEdit} disabled={savingStatus}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Save Updates</>}
            </button>
          </div>
        </div>
      )}

      {/* ADD PLACEMENT MODAL */}
      {isAddModalOpen && canAddPlacement && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsAddModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Add Manual Placement</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsAddModalOpen(false)} />
            </div>
            
            <h3 style={{ fontSize: '0.85rem', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '10px' }}>Student Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div><label className="data-label">Student Name *</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.name} onChange={e=>setAddForm({...addForm, name: e.target.value})} /></div>
              <div><label className="data-label">Roll Number *</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.roll} onChange={e=>setAddForm({...addForm, roll: e.target.value})} /></div>
              <div><label className="data-label">Contact No.</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.phone} onChange={e=>setAddForm({...addForm, phone: e.target.value})} /></div>
              <div><label className="data-label">Mail ID</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.email} onChange={e=>setAddForm({...addForm, email: e.target.value})} /></div>
              <div>
                <label className="data-label">Course</label>
                <select className="sleek-select" style={{ width: '100%' }} value={addForm.course} onChange={e=>setAddForm({...addForm, course: e.target.value})}>
                  <option value="Industrial Automation">Industrial Automation</option>
                  <option value="BMS AND CCTV">BMS AND CCTV</option>
                  <option value="Embedded and IoT">Embedded and IoT</option>
                  <option value="Digital Marketing">Digital Marketing</option>
                  <option value="Information technology (IT)">Information technology (IT)</option>
                </select>
              </div>
              <div><label className="data-label">Branch</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.branch} onChange={e=>setAddForm({...addForm, branch: e.target.value})} /></div>
            </div>

            <h3 style={{ fontSize: '0.85rem', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '10px' }}>Placement Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div><label className="data-label">Company Name *</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.company} onChange={e=>setAddForm({...addForm, company: e.target.value})} /></div>
              <div><label className="data-label">Position / Role</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.position} onChange={e=>setAddForm({...addForm, position: e.target.value})} /></div>
              <div><label className="data-label">Date Placed</label><input type="date" className="sleek-input" style={{ width: '100%' }} value={addForm.datePlaced} onChange={e=>setAddForm({...addForm, datePlaced: e.target.value})} /></div>
              <div><label className="data-label">Package (LPA)</label><input type="number" step="0.1" className="sleek-input" style={{ width: '100%' }} value={addForm.packageLpa} onChange={e=>setAddForm({...addForm, packageLpa: e.target.value})} /></div>
              <div>
                <label className="data-label">Joining Status</label>
                <select className="sleek-select" style={{ width: '100%' }} value={addForm.joiningStatus} onChange={e=>setAddForm({...addForm, joiningStatus: e.target.value})}>
                  <option value="Joined">Joined</option>
                  <option value="Not Joined">Not Joined</option>
                </select>
              </div>
              <div><label className="data-label">Upload Offer Letter</label><input type="file" className="sleek-input" style={{ width: '100%', padding: '6px' }} onChange={e=>setAddForm({...addForm, offerLetterFile: e.target.files[0]})} /></div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="data-label">Remarks</label>
              <input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.remarks} onChange={e=>setAddForm({...addForm, remarks: e.target.value})} />
            </div>

            <button className="btn-action" style={{ background: '#10b981', color: '#fff', width: '100%' }} onClick={submitAdd} disabled={savingStatus}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Save New Placement</>}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}