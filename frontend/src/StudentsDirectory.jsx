import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, MagnifyingGlass, UserCircle, CaretLeft, Users, WarningCircle, CheckCircle, Student } from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal.onrender.com";

// Vibrant color palette for the Avodha-style Branch Tiles
const TILE_COLORS = ['#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#f43f5e'];

export default function Students() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // View State Management
  const [selectedBranch, setSelectedBranch] = useState(null);
  
  // Directory Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All Courses');
  const [sortOrder, setSortOrder] = useState('Newest First');
  const [viewMode, setViewMode] = useState('list');

  useEffect(() => {
    if (tpoData) fetchStudents();
  }, [tpoData]);

  const fetchStudents = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/tpo/students`, { 
        assignedBranchesArray: tpoData.assignedBranchesArray 
      });
      if (res.data.success) {
        setAllStudents(res.data.students);
      }
    } catch (err) {
      console.error("Failed to fetch students:", err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // DATA PROCESSING FOR BRANCH TILES
  // ==========================================
  const branchData = {};
  allStudents.forEach(student => {
    const branchName = student.branch || 'Unknown Branch';
    if (!branchData[branchName]) branchData[branchName] = 0;
    branchData[branchName]++;
  });
  
  const branchList = Object.keys(branchData).sort();

  // ==========================================
  // DATA PROCESSING FOR SELECTED BRANCH DIRECTORY
  // ==========================================
  const activeStudents = selectedBranch ? allStudents.filter(s => s.branch === selectedBranch) : [];
  
  // Calculate specific stats for the selected branch
  const branchStats = {
    total: activeStudents.length,
    pending: activeStudents.filter(s => s.placementStatus.toLowerCase().includes('pending') || s.placementStatus === '').length,
    notResponding: activeStudents.filter(s => s.placementStatus.toLowerCase().includes('not responding')).length,
    noNeed: activeStudents.filter(s => s.placementStatus.toLowerCase().includes('no need')).length
  };

  const uniqueCourses = ['All Courses', ...new Set(activeStudents.map(s => s.course).filter(Boolean))];

  let filteredStudents = activeStudents.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          student.roll.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = courseFilter === 'All Courses' || student.course === courseFilter;
    return matchesSearch && matchesCourse;
  });

  if (sortOrder === 'Newest First') filteredStudents.reverse();

  // ==========================================
  // RENDER: VIEW 1 - AVODHA STYLE BRANCH TILES
  // ==========================================
  if (!selectedBranch) {
    return (
      <Layout>
        <div className="page-container" style={{ padding: 0 }}>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '5px', textAlign: 'center', marginTop: '20px' }}>Which branch would you like to view?</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', textAlign: 'center' }}>Select an assigned branch to view its registered students and placement statistics.</p>
          
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: '#38bdf8' }}><CircleNotch size={50} className="ph-spin" /></div>
          ) : branchList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>No students found in your assigned branches.</div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
              gap: '30px', 
              padding: '0 20px' 
            }}>
              {branchList.map((branch, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <div 
                    key={branch} 
                    onClick={() => setSelectedBranch(branch)}
                    style={{ 
                      backgroundColor: color, 
                      borderRadius: '24px', 
                      padding: '40px 20px', 
                      cursor: 'pointer', 
                      textAlign: 'center',
                      minHeight: '220px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'center',
                      alignItems: 'center',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-5px)';
                      e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
                    }}
                  >
                    <h2 style={{ color: '#ffffff', fontSize: '2.2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                      {branch}
                    </h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 'bold' }}>{branchData[branch]} Students</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ==========================================
  // RENDER: VIEW 2 - DETAILED DIRECTORY
  // ==========================================
  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {/* Navigation Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px', gap: '15px' }}>
          <button 
            onClick={() => setSelectedBranch(null)} 
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <CaretLeft weight="bold" size={18} /> Back to Branches
          </button>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>{selectedBranch} Directory</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Managing student profiles and placement status for {selectedBranch}.</p>
          </div>
        </div>

        {/* Dynamic Stat Cards for the Selected Branch */}
        <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
          <div className="stat-card">
            <div className="stat-info"><h3>{branchStats.total}</h3><p>TOTAL STUDENTS</p></div>
            <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}><Users size={28} weight="fill" /></div>
          </div>
          <div className="stat-card">
            <div className="stat-info"><h3>{branchStats.pending}</h3><p>PLACEMENT PENDING</p></div>
            <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><WarningCircle size={28} weight="fill" /></div>
          </div>
          <div className="stat-card">
            <div className="stat-info"><h3>{branchStats.notResponding}</h3><p>NOT RESPONDING</p></div>
            <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><CircleNotch size={28} weight="fill" /></div>
          </div>
          <div className="stat-card">
            <div className="stat-info"><h3>{branchStats.noNeed}</h3><p>PLACEMENT NOT NEEDED</p></div>
            <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}><CheckCircle size={28} weight="fill" /></div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
            <MagnifyingGlass size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="sleek-input" placeholder="Search name or roll..." style={{ width: '100%', paddingLeft: '45px' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          
          <select className="sleek-input" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          
          <select className="sleek-input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option>Newest First</option>
            <option>Oldest First</option>
          </select>
        </div>

        {/* Student List */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--card-border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <th style={{ padding: '15px 20px' }}>STUDENT DETAILS</th>
                <th style={{ padding: '15px 20px' }}>COURSE</th>
                <th style={{ padding: '15px 20px' }}>QUALIFICATION</th>
                <th style={{ padding: '15px 20px' }}>PLACEMENT STATUS</th>
                <th style={{ padding: '15px 20px', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length > 0 ? filteredStudents.map((student, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <td style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {student.photo ? (
                      <img src={student.photo} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserCircle size={24} color="#fff" />
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>{student.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{student.roll}</div>
                    </div>
                  </td>
                  <td style={{ padding: '15px 20px', color: '#cbd5e1' }}>{student.course}</td>
                  <td style={{ padding: '15px 20px', color: '#cbd5e1' }}>{student.qual}</td>
                  <td style={{ padding: '15px 20px' }}>
                    <span style={{ 
                      padding: '5px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid',
                      background: student.placementStatus.toLowerCase() === 'placed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      borderColor: student.placementStatus.toLowerCase() === 'placed' ? '#10b981' : '#f59e0b',
                      color: student.placementStatus.toLowerCase() === 'placed' ? '#10b981' : '#f59e0b'
                    }}>
                      {student.placementStatus.toUpperCase() || 'PENDING'}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => window.open(student.resume || '#', '_blank')}>
                      View CV
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No students match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </Layout>
  );
}