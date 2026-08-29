import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, SquaresFour, List, PencilSimple, X, FloppyDisk, 
  UserMinus, ClockClockwise, Prohibit, UsersThree, Briefcase, Files, Confetti, 
  FilePdf, GraduationCap, CaretLeft, Phone, WhatsappLogo, EnvelopeSimple, LinkedinLogo,
  ArrowCounterclockwise
} from '@phosphor-icons/react';
import Layout from './Layout';

const TILE_COLORS = ['#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#f43f5e'];

const getStandardCourse = (c) => {
  if (!c) return 'Others';
  const lower = c.toLowerCase().trim();
  if (lower.includes('bms') || lower.includes('cctv') || lower.includes('building management') || lower.includes('security system')) return 'BMS AND CCTV';
  if (lower.includes('automation') || lower.includes('plc') || lower.includes('dcs') || lower.includes('scada') || lower.includes('vfd') || lower.includes('panel') || lower.includes('marine') || lower.includes('networking')) return 'Industrial Automation';
  if (lower.includes('embed') || lower.includes('iot') || lower.includes('raspberry') || lower.includes('labview')) return 'Embedded and IoT';
  if (lower.includes('digital') || lower.includes('dm') || lower.includes('seo') || lower.includes('social media') || lower.includes('affiliate') || lower.includes('blogging') || lower.includes('marketing')) return 'Digital Marketing';
  if (lower.includes('it') || lower.includes('python') || lower.includes('software') || lower.includes('information') || lower.includes('data science') || lower.includes('full stack') || lower.includes('java') || lower.includes('stack') || lower.includes('artificial intelligence') || lower.includes('ai')) return 'Information technology (IT)';
  return 'Others';
};

const parseDate = (dStr) => {
  if (!dStr) return null;
  if (typeof dStr !== 'string') {
    const d = new Date(dStr);
    return isNaN(d) ? null : d;
  }
  if (dStr.includes('/') || (dStr.includes('-') && dStr.split('-')[0].length <= 2)) {
    const parts = dStr.split(/[/\s,.-]+/);
    if (parts.length >= 3) {
      if (parts[2].length === 4) {
        return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      }
    }
  }
  const d = new Date(dStr);
  return isNaN(d) ? null : d;
};

export default function StudentsDirectory() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const [rawStudents, setRawStudents] = useState([]);
  const [globalStats, setGlobalStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0 });
  const [loading, setLoading] = useState(true);
  
  const [selectedBranch, setSelectedBranch] = useState(null); 
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); 
  const [viewType, setViewType] = useState('list'); 

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  
  const [localVacState, setLocalVacState] = useState('');
  const [localPlacementState, setLocalPlacementState] = useState('');
  const [localStudyAccess, setLocalStudyAccess] = useState('');
  const [localExamAccess, setLocalExamAccess] = useState('');

  const upperRole = (tpoData?.role || '').toUpperCase();
  const isCourseSpecific = upperRole.includes('RTH') || upperRole.includes('REGIONAL TECHNICAL HEAD') || upperRole.includes('TTH') || upperRole.includes('TERRITORY TECHNICAL HEAD') || upperRole.includes('TRAINER');
  const displayCourse = tpoData?.assignedCourse || '';
  const isViewOnly = tpoData?.accessType === 'view'; 

  useEffect(() => {
    const fetchData = async () => {
      const localTpoStr = localStorage.getItem('tpoData');
      if (!localTpoStr) return;
      const localTpo = JSON.parse(localTpoStr);

      try {
        setLoading(true);
        const payload = { 
          assignedBranchesArray: localTpo.assignedBranchesArray,
          role: localTpo.role,
          assignedCourse: localTpo.assignedCourse
        };

        const [stuRes, statRes] = await Promise.all([
          axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/students', payload),
          axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/dashboard-stats', payload)
        ]);
        
        if (stuRes.data.success) {
          setRawStudents(stuRes.data.students);
        }
        if (statRes.data.success) {
          setGlobalStats(statRes.data.stats);
        }
      } catch (error) { 
        console.error("Failed to fetch students", error); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, []);

  const resetFilters = () => {
    setSearchQuery('');
    setCourseFilter('All');
    setMonthFilter('');
    setSortOrder('newest');
  };

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
    if (!fixedUrl || fixedUrl === 'N/A') return <span style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{initial}</span>;
    return (
      <img 
        src={fixedUrl} 
        alt={name} 
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        onError={(e) => { e.target.style.display='none'; e.target.parentNode.innerHTML = `<span style="font-size: 1.4rem; font-weight: bold;">${initial}</span>`; }} 
      />
    );
  };

  const openStudentModal = (student) => {
    setSelectedStudent(student);
    setLocalVacState(student.vacOpen || 'Yes');
    setLocalPlacementState(student.placementStatus || 'Pending');
    setLocalStudyAccess(student.studyAccess || 'No');
    setLocalExamAccess(student.examAccess || 'No');
    setIsModalOpen(true);
  };

  const saveStudentUpdates = async () => {
    setSavingStatus(true);
    try {
      const response = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/students/update-student', {
        rowNumber: selectedStudent.rowIdx,
        vacOpen: localVacState,
        placementStatus: localPlacementState,
        studyAccess: localStudyAccess,
        examAccess: localExamAccess
      });
      
      if (response.data.success) {
        const updatedStudents = rawStudents.map(s => s.rowIdx === selectedStudent.rowIdx ? { 
          ...s, 
          vacOpen: localVacState, 
          placementStatus: localPlacementState,
          studyAccess: localStudyAccess,
          examAccess: localExamAccess
        } : s);
        setRawStudents(updatedStudents);
        setIsModalOpen(false);
      }
    } catch (error) { 
      alert("Failed to update student data"); 
    } finally { 
      setSavingStatus(false); 
    }
  };

  // 1. Course specific restriction
  const scopedStudents = rawStudents.filter(s => {
    if (isCourseSpecific) {
      return getStandardCourse(s.course) === getStandardCourse(displayCourse);
    }
    return true;
  });

  // 2. Global Course and Month Filter
  const globallyFiltered = scopedStudents.filter(s => {
    let cMatch = courseFilter === 'All' || getStandardCourse(s.course) === getStandardCourse(courseFilter);
    
    // Check registration date / timestamp in rawData
    const dateKey = Object.keys(s.rawData || {}).find(k => k.toLowerCase().includes('timestamp') || k.toLowerCase().includes('date'));
    const dateVal = dateKey ? s.rawData[dateKey] : null;
    const dateObj = parseDate(dateVal);
    const monthKey = dateObj ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : '';
    let mMatch = monthFilter === '' || monthKey === monthFilter;

    return cMatch && mMatch;
  });

  const branchData = {};
  globallyFiltered.forEach(s => {
    const b = s.branch || 'Unknown';
    branchData[b] = (branchData[b] || 0) + 1;
  });
  const branchList = Object.keys(branchData).sort();

  const activeStudents = selectedBranch ? globallyFiltered.filter(s => s.branch === selectedBranch) : [];

  const branchStats = {
    pending: activeStudents.filter(s => s.placementStatus?.toLowerCase().includes('pending') || !s.placementStatus).length,
    notResponding: activeStudents.filter(s => s.placementStatus?.toLowerCase().includes('not responding')).length,
    noNeed: activeStudents.filter(s => s.placementStatus?.toLowerCase().includes('no need')).length
  };

  let filteredAndSorted = activeStudents.filter(s => {
    const matchQuery = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.roll && s.roll.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchQuery;
  });

  if (sortOrder === 'az') filteredAndSorted.sort((a, b) => a.name.localeCompare(b.name));
  if (sortOrder === 'za') filteredAndSorted.sort((a, b) => b.name.localeCompare(a.name));

  const getLinkedInUrl = (rawData) => {
    if (!rawData) return null;
    const key = Object.keys(rawData).find(k => k.toLowerCase().includes('linkedin'));
    let url = key ? rawData[key] : null;
    if (url && url !== 'N/A' && !url.startsWith('http')) {
      url = 'https://' + url;
    }
    return url && url !== 'N/A' ? url : null;
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {/* TOP KPI BAR */}
        {!selectedBranch && (
          <div className="universal-kpi-bar" style={{ marginBottom: '2.5rem' }}>
            <div className="kpi-card">
              <div>
                <div className="kpi-val">{globallyFiltered.length}</div>
                <div className="kpi-label">{isCourseSpecific ? `${displayCourse} Students` : 'Filtered Students'}</div>
              </div>
              <div className="kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}><UsersThree weight="fill"/></div>
            </div>
            <div className="kpi-card">
              <div>
                <div className="kpi-val">{globalStats.activeVacancies}</div>
                <div className="kpi-label">Active Vacancies</div>
              </div>
              <div className="kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}><Briefcase weight="fill"/></div>
            </div>
            <div className="kpi-card">
              <div>
                <div className="kpi-val">{globalStats.pendingApps}</div>
                <div className="kpi-label">Pending Apps</div>
              </div>
              <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><Files weight="fill"/></div>
            </div>
            <div className="kpi-card">
              <div>
                <div className="kpi-val">{globalStats.placed}</div>
                <div className="kpi-label">Total Hired</div>
              </div>
              <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><Confetti weight="fill"/></div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '15px' }}>
          {selectedBranch && (
            <button onClick={() => setSelectedBranch(null)} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CaretLeft weight="bold" size={18} /> Back to Branches
            </button>
          )}
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>
              {selectedBranch ? `${selectedBranch} Student Directory` : (isCourseSpecific ? `Branches with ${displayCourse} Students` : 'Student Directory')}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              {selectedBranch ? (isViewOnly ? 'View student profiles, resumes, and vacancy statuses.' : 'Manage student profiles, view resumes, and control access levels.') : 'Select an assigned branch to view its registered students and placement statistics.'}
            </p>
          </div>
        </div>

        {/* BRANCH METRICS WHEN INSIDE BRANCH */}
        {selectedBranch && (
          <div className="universal-kpi-bar" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="kpi-card" style={{ background: 'var(--bg-dark)' }}><div><div className="kpi-val">{branchStats.pending}</div><div className="kpi-label">Placement Pending</div></div><div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}><ClockClockwise weight="fill"/></div></div>
            <div className="kpi-card" style={{ background: 'var(--bg-dark)' }}><div><div className="kpi-val">{branchStats.notResponding}</div><div className="kpi-label">Not Responding</div></div><div className="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}><UserMinus weight="fill"/></div></div>
            <div className="kpi-card" style={{ background: 'var(--bg-dark)' }}><div><div className="kpi-val">{branchStats.noNeed}</div><div className="kpi-label">Placement Not Needed</div></div><div className="kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}><Prohibit weight="fill"/></div></div>
          </div>
        )}

        {/* UNIVERSAL FILTER BAR */}
        <div className="header-controls" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center', background: 'var(--card-bg)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
          
          {selectedBranch && (
            <input 
              type="text" 
              className="sleek-input" 
              placeholder="Search name or roll..." 
              style={{ minWidth: '200px', flex: 1 }}
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          )}

          {/* 5 MAIN COURSES */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Course:</span>
            <select 
              className="sleek-select" 
              style={{ minWidth: '190px' }}
              value={courseFilter} 
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="All">All Main Courses</option>
              <option value="Industrial Automation">Industrial Automation</option>
              <option value="BMS AND CCTV">BMS AND CCTV</option>
              <option value="Embedded and IoT">Embedded and IoT</option>
              <option value="Digital Marketing">Digital Marketing</option>
              <option value="Information technology (IT)">Information technology (IT)</option>
            </select>
          </div>

          {/* MONTH & YEAR FILTER */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Month/Year:</span>
            <input 
              type="month" 
              className="sleek-input" 
              style={{ minWidth: '150px' }}
              value={monthFilter} 
              onChange={(e) => setMonthFilter(e.target.value)} 
            />
          </div>

          {selectedBranch && (
            <>
              <select className="sleek-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="newest">Sort: Newest</option>
                <option value="az">Sort: A-Z</option>
                <option value="za">Sort: Z-A</option>
              </select>

              <div className="view-toggles" style={{ marginLeft: 'auto' }}>
                <button className={`view-btn ${viewType === 'grid' ? 'active' : ''}`} onClick={() => setViewType('grid')}><SquaresFour weight="fill" /></button>
                <button className={`view-btn ${viewType === 'list' ? 'active' : ''}`} onClick={() => setViewType('list')}><List weight="bold" /></button>
              </div>
            </>
          )}

          {(courseFilter !== 'All' || monthFilter !== '' || searchQuery !== '') && (
            <button 
              onClick={resetFilters}
              style={{ background: 'transparent', border: '1px solid #64748b', color: '#94a3b8', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}
            >
              <ArrowCounterclockwise size={14} /> Reset
            </button>
          )}
        </div>

        {/* MAIN BODY */}
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--accent-primary)' }}>
            <CircleNotch size={40} className="ph-spin" />
            <p>Fetching registered students...</p>
          </div>
        ) : !selectedBranch ? (
          /* BRANCH TILE VIEW */
          branchList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              No students found for the selected course and month filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
              {branchList.map((branch, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <div 
                    key={branch} 
                    onClick={() => setSelectedBranch(branch)}
                    style={{ backgroundColor: color, borderRadius: '20px', padding: '35px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                  >
                    <h2 style={{ color: '#ffffff', fontSize: '2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{branch}</h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <UsersThree size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 'bold' }}>{branchData[branch]} Students</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredAndSorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            No students found matching your criteria.
          </div>
        ) : viewType === 'grid' ? (
          <div className="student-grid">
            {filteredAndSorted.map((st, i) => (
              <div className="student-card" key={st.rowIdx || i}>
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
              <thead>
                <tr>
                  <th>Student Details</th>
                  <th>Branch & Course</th>
                  <th>Qualification</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((st, i) => (
                  <tr key={st.rowIdx || i}>
                    <td>
                      <div className="avatar-cell">
                        <div className="avatar">{renderAvatar(st.photo, st.name)}</div>
                        <div>
                          <span className="primary-text">{st.name}</span>
                          <span className="sub-text">{st.roll}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="primary-text">{st.branch}</span>
                      <span className="sub-text">{st.course}</span>
                    </td>
                    <td>
                      <span className="primary-text">{st.qual}</span>
                      <span className="sub-text">{st.stream}</span>
                    </td>
                    <td>
                      <span className={`badge ${st.status.toLowerCase().includes('completed') ? 'badge-green' : 'badge-blue'}`}>{st.status}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-secondary" onClick={() => openStudentModal(st)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                        <PencilSimple weight="bold" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && selectedStudent && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', overflow: 'hidden' }} 
          onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="modal-card" style={{ maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            <div className="student-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '1.2rem', margin: '0 0 1.5rem 0', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
                  {renderAvatar(selectedStudent.photo, selectedStudent.name)}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '1.4rem' }}>{selectedStudent.name}</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>{selectedStudent.roll}</span>
                  
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <a href={`tel:${selectedStudent.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', textDecoration: 'none' }}>
                      <Phone size={14} weight="fill" /> Call
                    </a>
                    <a href={`https://api.whatsapp.com/send?phone=${selectedStudent.phone ? (selectedStudent.phone.replace(/\D/g, '').length === 10 ? '91' + selectedStudent.phone.replace(/\D/g, '') : selectedStudent.phone.replace(/\D/g, '')) : ''}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(37, 211, 102, 0.15)', color: '#25D366', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', textDecoration: 'none' }}>
                      <WhatsappLogo size={14} weight="fill" /> WhatsApp
                    </a>
                    <a href={`mailto:${selectedStudent.email}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(234, 67, 53, 0.15)', color: '#ea4335', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', textDecoration: 'none' }}>
                      <EnvelopeSimple size={14} weight="fill" /> Mail
                    </a>
                    {getLinkedInUrl(selectedStudent.rawData) && (
                      <a href={getLinkedInUrl(selectedStudent.rawData)} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(10, 102, 194, 0.15)', color: '#4facfe', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', textDecoration: 'none' }}>
                        <LinkedinLogo size={14} weight="fill" /> LinkedIn
                      </a>
                    )}
                  </div>
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

            <div className="student-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              {Object.entries(selectedStudent.rawData).map(([key, val]) => {
                const lowerKey = key.toLowerCase();
                if(!val || val === 'N/A' || lowerKey.includes('photo') || lowerKey.includes('resume') || lowerKey.includes('certificate') || lowerKey.includes('timestamp') || lowerKey === 'row' || lowerKey === 'time' || lowerKey.includes('linkedin')) return null;
                return (
                  <div key={key} className="data-cell" style={{ background: '#161e2e', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <span className="data-label" style={{ display: 'block', fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>{key}</span>
                    <span className="data-value" style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 700, wordBreak: 'break-word' }}>{val}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '1.5rem' }}>
              
              {(tpoData?.accessType === 'superadmin' || !isCourseSpecific) && (
                <>
                  <div className="control-box" style={{ background: '#161e2e', border: '1px solid #1e293b', padding: '1rem 1.5rem', borderRadius: '12px' }}>
                    <span className="control-title" style={{ display: 'block', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Placement Status</span>
                    <select className="sleek-select" style={{ width: '100%', cursor: isViewOnly ? 'not-allowed' : 'pointer', opacity: isViewOnly ? 0.7 : 1 }} value={localPlacementState} onChange={(e) => setLocalPlacementState(e.target.value)} disabled={isViewOnly}>
                      <option value="Pending">Pending</option>
                      <option value="Placed">Placed</option>
                      <option value="Not Responding">Not Responding</option>
                      <option value="No Need of Placement">No Need of Placement</option>
                    </select>
                  </div>
                  <div className="control-box" style={{ background: '#161e2e', border: '1px solid #1e293b', padding: '1rem 1.5rem', borderRadius: '12px' }}>
                    <span className="control-title" style={{ display: 'block', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Vacancy Access</span>
                    <select className="sleek-select" style={{ width: '100%', cursor: isViewOnly ? 'not-allowed' : 'pointer', opacity: isViewOnly ? 0.7 : 1 }} value={localVacState} onChange={(e) => setLocalVacState(e.target.value)} disabled={isViewOnly}>
                      <option value="Yes">Yes (Allowed)</option>
                      <option value="No">No (Restricted)</option>
                    </select>
                  </div>
                </>
              )}

              {(tpoData?.accessType === 'superadmin' || isCourseSpecific) && (
                <>
                  <div className="control-box" style={{ background: '#161e2e', border: '1px solid #1e293b', padding: '1rem 1.5rem', borderRadius: '12px' }}>
                    <span className="control-title" style={{ display: 'block', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Study Material Access</span>
                    <select className="sleek-select" style={{ width: '100%', cursor: isViewOnly ? 'not-allowed' : 'pointer', opacity: isViewOnly ? 0.7 : 1 }} value={localStudyAccess} onChange={(e) => setLocalStudyAccess(e.target.value)} disabled={isViewOnly}>
                      <option value="Yes">Yes (Allowed)</option>
                      <option value="No">No (Restricted)</option>
                    </select>
                  </div>
                  <div className="control-box" style={{ background: '#161e2e', border: '1px solid #1e293b', padding: '1rem 1.5rem', borderRadius: '12px' }}>
                    <span className="control-title" style={{ display: 'block', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Technical Exam Access</span>
                    <select className="sleek-select" style={{ width: '100%', cursor: isViewOnly ? 'not-allowed' : 'pointer', opacity: isViewOnly ? 0.7 : 1 }} value={localExamAccess} onChange={(e) => setLocalExamAccess(e.target.value)} disabled={isViewOnly}>
                      <option value="Yes">Yes (Allowed)</option>
                      <option value="No">No (Restricted)</option>
                    </select>
                  </div>
                </>
              )}

            </div>

            <div style={{ display: 'flex', justifyContent: isViewOnly ? 'space-between' : 'flex-end', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
               {isViewOnly && <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>* View Only Permission</span>}
               <button className="btn-action" style={{ width: 'auto', background: isViewOnly ? '#1e293b' : '#38bdf8', color: isViewOnly ? '#94a3b8' : '#0f172a', padding: '0.8rem 2rem', fontSize: '1rem', margin: 0, cursor: isViewOnly ? 'not-allowed' : 'pointer' }} onClick={saveStudentUpdates} disabled={savingStatus || isViewOnly}>
                  {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> {isViewOnly ? 'Edit Locked' : 'Save All Changes'}</>}
                </button>
            </div>
            
          </div>
        </div>
      )}
    </Layout>
  );
}