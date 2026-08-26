import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, CaretLeft, Files } from '@phosphor-icons/react';
import Layout from './Layout';

const TILE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9', '#f43f5e'];

export default function StudentApps() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // View State Management (Dual-View)
  const [selectedBranch, setSelectedBranch] = useState(null);

  // Exact Original Filters
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  const [courseFilter, setCourseFilter] = useState('All');

  useEffect(() => {
    if (!tpoData) return;
    const fetchApps = async () => {
      try {
        const response = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications', { 
          assignedBranchesArray: tpoData.assignedBranchesArray,
          tpoName: tpoData.name,
          role: tpoData.role,
          assignedCourse: tpoData.assignedCourse
        });
        if (response.data.success) {
          setApplications(response.data.applications);
        }
      } catch (error) { console.error("Failed", error); } finally { setLoading(false); }
    };
    fetchApps();
  }, [tpoData]);

  // ==========================================
  // DATA PREP FOR BRANCH TILES
  // ==========================================
  const branchData = {};
  applications.forEach(a => {
    const b = a.branch || 'Unknown';
    branchData[b] = (branchData[b] || 0) + 1;
  });
  const branchList = Object.keys(branchData).sort();

  // ==========================================
  // DATA PREP FOR SELECTED BRANCH (VIEW 2)
  // ==========================================
  const activeApps = selectedBranch ? applications.filter(a => a.branch === selectedBranch) : [];

  const filteredApps = activeApps.filter(a => {
    let dateObj = new Date(a.date);
    let monthKey = !isNaN(dateObj) ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : '';
    let mMatch = monthFilter ? monthKey === monthFilter : true;
    let cMatch = courseFilter === 'All' || a.course.toLowerCase().includes(courseFilter.toLowerCase());
    return mMatch && cMatch;
  });

  // ==========================================
  // RENDER: VIEW 1 - BRANCH TILES LANDING
  // ==========================================
  if (!selectedBranch) {
    return (
      <Layout>
        <div className="page-container" style={{ padding: 0 }}>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '5px', textAlign: 'center', marginTop: '20px' }}>Which branch's applications?</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', textAlign: 'center' }}>Select a branch to view all job applications submitted by its students.</p>
          
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: '#3b82f6' }}><CircleNotch size={50} className="ph-spin" /></div>
          ) : branchList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>No applications found in your branches.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px', padding: '0 20px' }}>
              {branchList.map((branch, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <div 
                    key={branch} 
                    onClick={() => setSelectedBranch(branch)}
                    style={{ backgroundColor: color, borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
                  >
                    <h2 style={{ color: '#ffffff', fontSize: '2.2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                      {branch}
                    </h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Files size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 'bold' }}>{branchData[branch]} Applications</span>
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
  // RENDER: VIEW 2 - DETAILED APPLICATIONS TABLE
  // ==========================================
  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px', gap: '15px' }}>
          <button 
            onClick={() => setSelectedBranch(null)} 
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <CaretLeft weight="bold" size={18} /> Back to Branches
          </button>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>{selectedBranch} Applications</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>A view-only dashboard of all applications submitted by students in {selectedBranch}.</p>
          </div>
        </div>

        <div className="header-controls" style={{ justifyContent: 'flex-start' }}>
          <input type="month" className="sleek-input" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          <select className="sleek-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="All">All Courses</option>
            <option value="Industrial Automation">Industrial Automation</option>
            <option value="BMS & CCTV">BMS & CCTV</option>
            <option value="Python and Data Science">Python</option>
            <option value="Digital Marketing">Digital Marketing</option>
          </select>
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Applied Job</th>
                <th>Date</th>
                <th>TPO Name</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}><CircleNotch size={24} className="ph-spin" /> Fetching applications...</td></tr>
              ) : filteredApps.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No applications found matching filters.</td></tr>
              ) : (
                filteredApps.map((app, i) => {
                  let statClass = 'badge-blue';
                  let s = (app.status || '').toLowerCase();
                  if(s.includes('interview')) statClass = 'badge-purple';
                  if(s.includes('offer') || s.includes('placed') || s.includes('joined')) statClass = 'badge-green';
                  if(s.includes('reject') || s.includes('not attended')) statClass = 'badge-gray';

                  return (
                    <tr key={i}>
                      <td><span className="primary-text">{app.name}</span><span className="sub-text">{app.roll}</span></td>
                      <td><span className="primary-text">{app.jobId}</span><span className="sub-text">{app.company}</span></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{app.date ? app.date.split(' ')[0] : 'N/A'}</td>
                      <td><strong style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>{app.tpoName || 'N/A'}</strong></td>
                      <td><span className={`badge ${statClass}`}>{app.status || 'Applied'}</span></td>
                      <td style={{ fontSize: '0.85rem', color: '#cbd5e1', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={app.remarks}>
                        {app.remarks || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}