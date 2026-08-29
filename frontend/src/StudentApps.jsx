import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, CaretLeft, Files, ArrowsClockwise } from '@phosphor-icons/react';
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

export default function StudentApps() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');

  useEffect(() => {
    const fetchApps = async () => {
      const localTpoStr = localStorage.getItem('tpoData');
      if (!localTpoStr) return;
      const localTpo = JSON.parse(localTpoStr);
      
      try {
        setLoading(true);
        const response = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications', { 
          assignedBranchesArray: localTpo.assignedBranchesArray,
          tpoName: localTpo.name,
          role: localTpo.role,
          assignedCourse: localTpo.assignedCourse
        });
        if (response.data.success) {
          setApplications(response.data.applications);
        }
      } catch (error) { 
        console.error("Failed to load student applications", error); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchApps();
  }, []);

  const resetFilters = () => {
    setSearchQuery('');
    setMonthFilter('');
    setCourseFilter('All');
  };

  const globallyFiltered = applications.filter(a => {
    let dateObj = parseDate(a.date);
    let monthKey = dateObj ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : '';
    let mMatch = monthFilter === '' ? true : monthKey === monthFilter;
    let cMatch = courseFilter === 'All' || getStandardCourse(a.course) === getStandardCourse(courseFilter);
    return mMatch && cMatch;
  });

  const branchData = {};
  globallyFiltered.forEach(a => {
    const b = a.branch || 'Unknown';
    branchData[b] = (branchData[b] || 0) + 1;
  });
  const branchList = Object.keys(branchData).sort();

  const activeApps = selectedBranch ? globallyFiltered.filter(a => a.branch === selectedBranch) : [];

  const filteredApps = activeApps.filter(a => {
    let sMatch = searchQuery === '' || 
      (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (a.company || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (a.roll || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.jobId || '').toLowerCase().includes(searchQuery.toLowerCase());
    return sMatch;
  });

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            {selectedBranch ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => setSelectedBranch(null)} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CaretLeft weight="bold" size={18} /> Back to Branches
                </button>
                <div>
                  <h1 style={{ fontSize: '1.8rem', margin: 0 }}>{selectedBranch} Applications</h1>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>View-only log of all job applications submitted by students in {selectedBranch}.</p>
                </div>
              </div>
            ) : (
              <div>
                <h1 style={{ fontSize: '2.2rem', marginBottom: '5px' }}>Student Applications View</h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Filter and explore job drive submissions across all branches.</p>
              </div>
            )}
          </div>
        </div>

        {/* UNIVERSAL FILTER BAR */}
        <div className="header-controls" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center', background: 'var(--card-bg)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
          {selectedBranch && (
            <input type="text" className="sleek-input" placeholder="Search student, roll, job ID..." style={{ minWidth: '220px', flex: 1 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          )}

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Month/Year:</span>
            <input type="month" className="sleek-input" style={{ minWidth: '150px' }} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          </div>

          {(courseFilter !== 'All' || monthFilter !== '' || searchQuery !== '') && (
            <button onClick={resetFilters} style={{ background: 'transparent', border: '1px solid #64748b', color: '#94a3b8', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
              <ArrowsClockwise size={14} /> Reset
            </button>
          )}
        </div>

        {/* CONTENT */}
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: '#3b82f6' }}>
            <CircleNotch size={50} className="ph-spin" />
            <p style={{ marginTop: '10px', color: 'var(--text-muted)' }}>Fetching application records...</p>
          </div>
        ) : !selectedBranch ? (
          branchList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              No applications match the selected Course and Month filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px', marginTop: '15px' }}>
              {branchList.map((branch, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <div key={branch} onClick={() => setSelectedBranch(branch)} style={{ backgroundColor: color, borderRadius: '20px', padding: '35px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                    <h2 style={{ color: '#ffffff', fontSize: '2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{branch}</h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Files size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 'bold' }}>{branchData[branch]} Applications</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="table-container" style={{ marginTop: '1.5rem' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Applied Job</th>
                  <th>Date</th>
                  <th>Placement Officer</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem' }}>
                      No applications found matching the current search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((app, i) => {
                    let statClass = 'badge-blue';
                    let s = (app.status || '').toLowerCase();
                    if(s.includes('interview')) statClass = 'badge-purple';
                    if(s.includes('offer') || s.includes('placed') || s.includes('join')) statClass = 'badge-green';
                    if(s.includes('reject') || s.includes('not attended')) statClass = 'badge-gray';

                    return (
                      <tr key={app.rowNumber || i}>
                        <td>
                          <span className="primary-text">{app.name}</span>
                          <span className="sub-text">{app.roll || 'No Roll #'} • {app.course}</span>
                        </td>
                        <td>
                          <span className="primary-text">{app.jobId || 'General Drive'}</span>
                          <span className="sub-text">{app.company}</span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {app.date ? (app.date.includes('/') ? app.date.split(' ')[0] : new Date(app.date).toLocaleDateString('en-GB')) : 'N/A'}
                        </td>
                        <td>
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>{app.tpoName || 'N/A'}</strong>
                        </td>
                        <td>
                          <span className={`badge ${statClass}`}>{app.status || 'Applied'}</span>
                        </td>
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
        )}
      </div>
    </Layout>
  );
}