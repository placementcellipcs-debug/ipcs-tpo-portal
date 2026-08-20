import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, SquaresFour, List, PencilSimple, X, FloppyDisk, 
  UserMinus, ClockClockwise, Prohibit, UsersThree, Briefcase, Files, Confetti, FilePdf, GraduationCap 
} from '@phosphor-icons/react';
import Layout from './Layout';

export default function StudentsDirectory() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [students, setStudents] = useState([]);
  
  // Stats States
  const [stats, setStats] = useState({ total: 0, pending: 0, notResponding: 0, noNeed: 0 });
  const [globalStats, setGlobalStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0 });
  const [loading, setLoading] = useState(true);
  
  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest'); // newest, az, za
  const [viewType, setViewType] = useState('list'); 

  // Modal State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [localVacState, setLocalVacState] = useState('');
  const [localPlacementState, setLocalPlacementState] = useState('');

  const uniqueBranches = [...new Set(students.map(s => s.branch))];
  const uniqueCourses = [...new Set(students.map(s => s.course))];

  useEffect(() => {
    if (!tpoData) return;
    const fetchData = async () => {
      try {
        const [stuRes, statRes] = await Promise.all([
          axios.post('http://localhost:5000/api/tpo/students', { assignedBranchesArray: tpoData.assignedBranchesArray }),
          axios.post('http://localhost:5000/api/tpo/dashboard-stats', { assignedBranchesArray: tpoData.assignedBranchesArray })
        ]);
        if (stuRes.data.success) {
          setStudents(stuRes.data.students);
          setStats(stuRes.data.stats);
        }
        if (statRes.data.success) setGlobalStats(statRes.data.stats);
      } catch (error) { console.error("Failed", error); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };

  const getDrivePdf = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://drive.google.com/file/d/${match[1]}/view` : url;
  };

  const renderAvatar = (url, name) => {
    const fixedUrl = getDriveImage(url);
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    if (!fixedUrl || fixedUrl === 'N/A') return <span style={{fontSize: '1.4rem', fontWeight: 'bold'}}>{initial}</span>;
    return (
      <img 
        src={fixedUrl} 
        alt={name} 
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        onError={(e) => { e.target.style.display='none'; e.target.parentNode.innerHTML = `<span style="font-size: 1.4rem; font-weight: bold;">${initial}</span>`; }} 
      />
    );
  };

  // 1. Filter
  let filteredAndSorted = students.filter(s => {
    const matchQuery = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.roll && s.roll.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCourse = courseFilter === 'All' || s.course === courseFilter;
    const matchBranch = branchFilter === 'All' || s.branch === branchFilter;
    return matchQuery && matchCourse && matchBranch;
  });

  // 2. Sort
  if (sortOrder === 'az') filteredAndSorted.sort((a, b) => a.name.localeCompare(b.name));
  if (sortOrder === 'za') filteredAndSorted.sort((a, b) => b.name.localeCompare(a.name));

  const openStudentModal = (student) => {
    setSelectedStudent(student);
    setLocalVacState(student.vacOpen || 'Yes');
    setLocalPlacementState(student.placementStatus || 'Pending');
    setIsModalOpen(true);
  };

  const saveStudentUpdates = async () => {
    setSavingStatus(true);
    try {
      const response = await axios.post('http://localhost:5000/api/tpo/students/update-student', {
        rowNumber: selectedStudent.rowIdx,
        vacOpen: localVacState,
        placementStatus: localPlacementState
      });
      if (response.data.success) {
        const updatedStudents = students.map(s => s.rowIdx === selectedStudent.rowIdx ? { ...s, vacOpen: localVacState, placementStatus: localPlacementState } : s);
        setStudents(updatedStudents);
        
        let newNotRes = 0; let newNoNeed = 0; let newPending = 0;
        updatedStudents.forEach(s => {
          const pLower = s.placementStatus.toLowerCase();
          if (pLower.includes('not responding')) newNotRes++;
          else if (pLower.includes('no need')) newNoNeed++;
          else if (pLower.includes('pending') || pLower === '') newPending++;
        });
        setStats(prev => ({ ...prev, notResponding: newNotRes, noNeed: newNoNeed, pending: newPending }));
        setIsModalOpen(false);
      }
    } catch (error) { alert("Failed to update student data"); } finally { setSavingStatus(false); }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {/* REFINED 7-TILE LAYOUT (4 on top, 3 dynamically stretched on bottom) */}
        {!loading && (
          <>
            {/* ROW 1: Global Stats (4 Tiles) */}
            <div className="universal-kpi-bar" style={{ marginBottom: '1rem' }}>
              <div className="kpi-card"><div><div className="kpi-val">{globalStats.totalStudents}</div><div className="kpi-label">Total Students</div></div><div className="kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}><UsersThree weight="fill"/></div></div>
              <div className="kpi-card"><div><div className="kpi-val">{globalStats.activeVacancies}</div><div className="kpi-label">Active Vacancies</div></div><div className="kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}><Briefcase weight="fill"/></div></div>
              <div className="kpi-card"><div><div className="kpi-val">{globalStats.pendingApps}</div><div className="kpi-label">Pending Apps</div></div><div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><Files weight="fill"/></div></div>
              <div className="kpi-card"><div><div className="kpi-val">{globalStats.placed}</div><div className="kpi-label">Total Hired</div></div><div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><Confetti weight="fill"/></div></div>
            </div>

            {/* ROW 2: Placement Specific Stats (3 Tiles) */}
            <div className="universal-kpi-bar" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="kpi-card" style={{ background: 'var(--bg-dark)' }}><div><div className="kpi-val">{stats.pending}</div><div className="kpi-label">Placement Pending</div></div><div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}><ClockClockwise weight="fill"/></div></div>
              <div className="kpi-card" style={{ background: 'var(--bg-dark)' }}><div><div className="kpi-val">{stats.notResponding}</div><div className="kpi-label">Not Responding</div></div><div className="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}><UserMinus weight="fill"/></div></div>
              <div className="kpi-card" style={{ background: 'var(--bg-dark)' }}><div><div className="kpi-val">{stats.noNeed}</div><div className="kpi-label">Placement Not Needed</div></div><div className="kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}><Prohibit weight="fill"/></div></div>
            </div>
          </>
        )}

        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Students Directory</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Manage student profiles, view resumes, and control vacancy access.</p>
        
        <div className="header-controls">
          <div className="filter-group">
            <input type="text" className="sleek-input" placeholder="Search name or roll..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <select className="sleek-select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}><option value="All">All Branches</option>{uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}</select>
            <select className="sleek-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}><option value="All">All Courses</option>{uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select className="sleek-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}><option value="newest">Sort: Newest First</option><option value="az">Sort: A-Z</option><option value="za">Sort: Z-A</option></select>
          </div>
          <div className="view-toggles">
            <button className={`view-btn ${viewType === 'grid' ? 'active' : ''}`} onClick={() => setViewType('grid')}><SquaresFour weight="fill" /></button>
            <button className={`view-btn ${viewType === 'list' ? 'active' : ''}`} onClick={() => setViewType('list')}><List weight="bold" /></button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--accent-primary)' }}><CircleNotch size={40} className="ph-spin" /><p>Fetching students...</p></div>
        ) : filteredAndSorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>No students found.</div>
        ) : viewType === 'grid' ? (
          <div className="student-grid">
            {filteredAndSorted.map((st, i) => (
              <div className="student-card" key={i}>
                <div className="sc-avatar">{renderAvatar(st.photo, st.name)}</div>
                <div className="sc-name">{st.name}</div>
                <div className="sc-roll">{st.roll !== 'N/A' ? st.roll : 'No Roll #'}</div>
                <div className="sc-details">
                  <div className="sc-detail-row"><span>Branch</span><strong style={{ color: 'var(--text-main)' }}>{st.branch}</strong></div>
                  <div className="sc-detail-row"><span>Course</span><strong style={{ color: 'var(--text-main)' }}>{st.course}</strong></div>
                  <div className="sc-detail-row"><span>Contact</span><strong style={{ color: 'var(--text-main)' }}>{st.phone}</strong></div>
                  <div className="sc-detail-row"><span>Status</span><strong style={{ color: st.status.toLowerCase().includes('completed') ? '#10b981' : '#38bdf8' }}>{st.status}</strong></div>
                </div>
                <button className="btn-secondary" style={{ width: '100%', padding: '0.5rem' }} onClick={() => openStudentModal(st)}>View Profile</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-container">
            <table className="modern-table">
              <thead><tr><th>Student Details</th><th>Branch & Course</th><th>Qualification</th><th>Status</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
              <tbody>
                {filteredAndSorted.map((st, i) => (
                  <tr key={i}>
                    <td><div className="avatar-cell"><div className="avatar">{renderAvatar(st.photo, st.name)}</div><div><span className="primary-text">{st.name}</span><span className="sub-text">{st.roll}</span></div></div></td>
                    <td><span className="primary-text">{st.branch}</span><span className="sub-text">{st.course}</span></td>
                    <td><span className="primary-text">{st.qual}</span><span className="sub-text">{st.stream}</span></td>
                    <td><span className={`badge ${st.status.toLowerCase().includes('completed') ? 'badge-green' : 'badge-blue'}`}>{st.status}</span></td>
                    <td style={{ textAlign: 'center' }}><button className="btn-secondary" onClick={() => openStudentModal(st)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}><PencilSimple weight="bold" /> View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BULLETPROOF ABSOLUTE CENTERED OVERLAY MODAL */}
      {isModalOpen && selectedStudent && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
            zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '20px', overflow: 'hidden'
          }} 
          onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="modal-card" style={{ maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            <div className="student-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1.2rem', margin: '0 0 1.5rem 0', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
                  {renderAvatar(selectedStudent.photo, selectedStudent.name)}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '1.4rem' }}>{selectedStudent.name}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 700 }}>{selectedStudent.roll}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {selectedStudent.resume && selectedStudent.resume !== 'N/A' && (
                  <button className="btn-secondary" onClick={() => window.open(getDrivePdf(selectedStudent.resume) || selectedStudent.resume, '_blank')} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid #f59e0b', margin: 0, padding: '0.5rem 0.8rem' }}>
                    <FilePdf size={18} weight="fill" /> Resume
                  </button>
                )}
                {selectedStudent.certificate && selectedStudent.certificate !== 'N/A' && (
                  <button className="btn-secondary" onClick={() => window.open(getDrivePdf(selectedStudent.certificate) || selectedStudent.certificate, '_blank')} style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid #38bdf8', margin: 0, padding: '0.5rem 0.8rem' }}>
                    <GraduationCap size={18} weight="fill" /> Certificate
                  </button>
                )}
                <X size={28} style={{ cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '10px' }} onClick={() => setIsModalOpen(false)} />
              </div>
            </div>

            {/* RAW DATA GRID (With Timestamp Filtered Out) */}
            <div className="student-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              {Object.entries(selectedStudent.rawData).map(([key, val]) => {
                const lowerKey = key.toLowerCase();
                if(!val || val === 'N/A' || lowerKey.includes('photo') || lowerKey.includes('resume') || lowerKey.includes('certificate') || lowerKey.includes('timestamp') || lowerKey === 'row' || lowerKey === 'time') return null;
                return (
                  <div key={key} className="data-cell" style={{ background: '#161e2e', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <span className="data-label" style={{ display: 'block', fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>{key}</span>
                    <span className="data-value" style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 700, wordBreak: 'break-word' }}>{val}</span>
                  </div>
                );
              })}
            </div>

            {/* CONTROL SECTION BOXES */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '1.5rem' }}>
              <div className="control-box" style={{ background: '#161e2e', border: '1px solid #1e293b', padding: '1rem 1.5rem', borderRadius: '12px' }}>
                <span className="control-title" style={{ display: 'block', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Placement Status</span>
                <select className="sleek-select" style={{ width: '100%' }} value={localPlacementState} onChange={(e) => setLocalPlacementState(e.target.value)}>
                  <option value="Pending">Pending</option><option value="Placed">Placed</option><option value="Not Responding">Not Responding</option><option value="No Need of Placement">No Need of Placement</option>
                </select>
              </div>
              <div className="control-box" style={{ background: '#161e2e', border: '1px solid #1e293b', padding: '1rem 1.5rem', borderRadius: '12px' }}>
                <span className="control-title" style={{ display: 'block', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Vacancy Access</span>
                <select className="sleek-select" style={{ width: '100%' }} value={localVacState} onChange={(e) => setLocalVacState(e.target.value)}>
                  <option value="Yes">Yes (Allowed)</option><option value="No">No (Restricted)</option>
                </select>
              </div>
            </div>

            {/* UNIFIED SAVE BUTTON */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #1e293b', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
               <button className="btn-action" style={{ width: 'auto', background: '#38bdf8', color: '#0f172a', padding: '0.8rem 2rem', fontSize: '1rem', margin: 0 }} onClick={saveStudentUpdates} disabled={savingStatus}>
                  {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Save All Changes</>}
                </button>
            </div>

          </div>
        </div>
      )}

    </Layout>
  );
}