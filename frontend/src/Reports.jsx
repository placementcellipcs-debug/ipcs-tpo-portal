import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Target, ChartLineUp, Buildings, ShieldCheck, Briefcase, UsersThree } from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal-u0l6.onrender.com";
const COURSES = ['Automation', 'BMS', 'IT', 'DM', 'Embedded'];

export default function Reports() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(1);

  const currentMonthStr = new Date().toISOString().slice(0, 7); 
  const [monthFilter, setMonthFilter] = useState(currentMonthStr);

  const [students, setStudents] = useState([]);
  const [applications, setApplications] = useState([]);
  const [vacancies, setVacancies] = useState([]); 
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // 🚨 FIX: Data fetch isolated inside the hook, dependency array empty
    const fetchAllData = async () => {
      try {
        const res = await axios.post(`${API_BASE}/api/tpo/reports`, { assignedBranchesArray: ['all'] });
        if (res.data.success) {
          setStudents(res.data.students || []);
          setApplications(res.data.applications || []);
          setVacancies(res.data.vacancies || []);
          setEvents(res.data.events || []);
        }
      } catch (error) {
        console.error("Failed to fetch reports", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []); // 🚨 CRITICAL FIX: Stops the loop!

  const getCourse = (c) => {
    if(!c) return 'Others';
    const lower = c.toLowerCase();
    if(lower.includes('auto')) return 'Automation';
    if(lower.includes('bms')) return 'BMS';
    if(lower.includes('it') || lower.includes('python') || lower.includes('software')) return 'IT';
    if(lower.includes('digital') || lower.includes('dm')) return 'DM';
    if(lower.includes('embed')) return 'Embedded';
    return 'Others';
  };

  const checkMonth = (dateStr) => {
    if (!monthFilter) return true;
    if (!dateStr) return false;
    let year, month;
    if (dateStr.includes('/')) {
      const parts = dateStr.split(' ')[0].split('/');
      year = parts[2];
      month = parts[1];
    } else {
      const d = new Date(dateStr);
      if (isNaN(d)) return false;
      year = d.getFullYear();
      month = String(d.getMonth() + 1).padStart(2, '0');
    }
    return `${year}-${month}` === monthFilter;
  };

  const isAssignedBranch = (b) => {
    if (!tpoData || !tpoData.assignedBranchesArray) return false;
    if (tpoData.assignedBranchesArray.includes('all')) return true;
    return tpoData.assignedBranchesArray.some(assigned => (b || '').toLowerCase().includes(assigned.toLowerCase()));
  };

  const getHashId = (email) => {
    if (!email) return '0000';
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash).toString().substring(0, 4);
  };

  const displayMonthName = new Date(monthFilter + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
  const tpoNameLower = (tpoData?.name || '').toLowerCase();
  
  const myFilteredApps = applications.filter(a => (a.tpoName || '').toLowerCase() === tpoNameLower && checkMonth(a.date));
  const myPlacementCounts = { Automation: 0, BMS: 0, IT: 0, DM: 0, Embedded: 0, Others: 0 };
  let myTotalPlacements = 0;

  myFilteredApps.forEach(a => {
    const stat = (a.status || '').toLowerCase();
    if (stat.includes('placed') || stat.includes('join') || stat.includes('offer')) {
      const c = getCourse(a.course);
      if (myPlacementCounts[c] !== undefined) myPlacementCounts[c]++;
      myTotalPlacements++;
    }
  });

  const targetGoal = 20;
  const progressPercent = Math.min((myTotalPlacements / targetGoal) * 100, 100);

  const assignedBranches = [...new Set(students.filter(s => isAssignedBranch(s.branch)).map(s => s.branch))].filter(Boolean).sort();
  const branchEnrolls = {};
  assignedBranches.forEach(b => branchEnrolls[b] = { Automation: 0, BMS: 0, IT: 0, DM: 0, Embedded: 0, Others: 0, Total: 0 });

  students.forEach(s => {
    if (isAssignedBranch(s.branch) && branchEnrolls[s.branch]) {
      const c = getCourse(s.course);
      if (branchEnrolls[s.branch][c] !== undefined) branchEnrolls[s.branch][c]++;
      branchEnrolls[s.branch].Total++;
    }
  });

  const allBranches = [...new Set(students.map(s => s.branch))].filter(b => b && b !== 'Unknown').sort();
  const branchPlaces = {};
  allBranches.forEach(b => branchPlaces[b] = { Automation: 0, BMS: 0, IT: 0, DM: 0, Embedded: 0, Others: 0, Total: 0 });

  applications.forEach(a => {
    const b = a.branch;
    if (branchPlaces[b] && checkMonth(a.date)) {
      const stat = (a.status || '').toLowerCase();
      if(stat.includes('placed') || stat.includes('join') || stat.includes('offer')) {
        const c = getCourse(a.course);
        if (branchPlaces[b][c] !== undefined) branchPlaces[b][c]++;
        branchPlaces[b].Total++;
      }
    }
  });

  const activeTPOs = [...new Set(applications.map(a => a.tpoName))].filter(t => t && t !== 'Unknown').sort();
  const branchTPO = {};
  allBranches.forEach(b => {
    branchTPO[b] = { Total: 0 };
    activeTPOs.forEach(t => branchTPO[b][t] = 0);
  });

  applications.forEach(a => {
    const b = a.branch;
    const t = a.tpoName;
    if (branchTPO[b] && branchTPO[b][t] !== undefined && checkMonth(a.date)) {
      const stat = (a.status || '').toLowerCase();
      if(stat.includes('placed') || stat.includes('join') || stat.includes('offer')) {
        branchTPO[b][t]++;
        branchTPO[b].Total++;
      }
    }
  });

  const pipeline = {};
  COURSES.concat(['Others']).forEach(c => pipeline[c] = { placed: 0, joined: 0, notJoined: 0 });

  applications.forEach(a => {
    if (!checkMonth(a.date)) return;
    const c = getCourse(a.course);
    if (!pipeline[c]) return;
    const stat = (a.status || '').toLowerCase();
    
    if (stat.includes('placed') || stat.includes('offer')) pipeline[c].placed++;
    else if (stat.includes('join')) { pipeline[c].placed++; pipeline[c].joined++; }
    else if (stat.includes('reject') || stat.includes('not attend')) pipeline[c].notJoined++;
  });

  const pendingByCourse = {};
  assignedBranches.forEach(b => {
    pendingByCourse[b] = { Automation: 0, BMS: 0, IT: 0, DM: 0, Embedded: 0, Others: 0, Total: 0 };
  });

  students.forEach(s => {
    if (isAssignedBranch(s.branch) && pendingByCourse[s.branch]) {
      const stat = (s.placementStatus || '').toLowerCase();
      if (stat.includes('pending') || stat === '') {
        const c = getCourse(s.course);
        if (pendingByCourse[s.branch][c] !== undefined) pendingByCourse[s.branch][c]++;
        pendingByCourse[s.branch].Total++;
      }
    }
  });

  const newsLetterStats = {};
  COURSES.concat(['Others']).forEach(c => newsLetterStats[c] = 0);
  
  vacancies.forEach(v => {
    if (!checkMonth(v.date)) return;
    const c = getCourse(v.course);
    if (newsLetterStats[c] !== undefined) newsLetterStats[c]++;
  });

  const tpoActivity = activeTPOs.map(t => {
    const apps = applications.filter(a => a.tpoName === t && checkMonth(a.date));
    const joined = apps.filter(a => (a.status || '').toLowerCase().includes('join')).length;
    const notJoined = apps.filter(a => (a.status || '').toLowerCase().includes('reject') || (a.status || '').toLowerCase().includes('not attend')).length;
    
    const uniqueCompanies = new Set(apps.map(a => a.company).filter(Boolean));

    const tpoEvents = events.filter(e => e.tpo === t && checkMonth(e.date));
    const drivesConducted = tpoEvents.filter(e => (e.type || '').toLowerCase().includes('drive')).length;

    return {
      tpo: t,
      companiesVisited: uniqueCompanies.size,
      drivesConducted: drivesConducted,
      postersMade: 0,
      videosMade: 0, 
      joining: joined,
      notJoining: notJoined,
      totalApps: apps.length
    };
  });

  const reportStyles = `
    .rt-tabs { display: flex; gap: 12px; margin-bottom: 25px; overflow-x: auto; padding-bottom: 10px; }
    .rt-tab { background: var(--card-bg); border: 1px solid var(--card-border); color: var(--text-muted); padding: 12px 24px; border-radius: 30px; cursor: pointer; white-space: nowrap; font-weight: bold; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
    .rt-tab:hover { background: #1e293b; color: #fff; }
    .rt-tab.active { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: #38bdf8; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.2); }
    
    .hero-card { background: #0f1523; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; margin-bottom: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    .hc-header { background: linear-gradient(90deg, #0284c7, #3b82f6); color: #fff; padding: 18px 25px; font-size: 1.2rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; align-items: center; }
    .hc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1px; background: #1e293b; }
    .hc-item { background: #0f1523; padding: 20px 25px; }
    .hc-label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; font-weight: bold; letter-spacing: 0.5px; }
    .hc-value { font-size: 1.15rem; color: #fff; font-weight: 600; word-break: break-word; }
    .hc-subheader { background: #161e2e; color: #38bdf8; padding: 15px 25px; font-weight: bold; border-top: 1px solid #1e293b; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 10px; }
    
    .data-table-wrap { background: #0f1523; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; margin-bottom: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
    .data-table-head { background: #161e2e; padding: 18px 20px; font-weight: bold; color: #fff; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }
    .dt { width: 100%; border-collapse: collapse; }
    .dt th { background: #0f1523; color: #94a3b8; padding: 14px 15px; text-align: center; font-size: 0.8rem; text-transform: uppercase; border-bottom: 1px solid #1e293b; white-space: nowrap; font-weight: 800; border-right: 1px solid #1e293b; }
    .dt th:first-child { text-align: left; }
    .dt td { padding: 14px 15px; color: #cbd5e1; border-bottom: 1px solid #1e293b; font-size: 0.95rem; text-align: center; border-right: 1px solid #1e293b; font-weight: 600; }
    .dt td:first-child { text-align: left; color: #fff; }
    .dt tr:hover td { background: #161e2e; }
    .dt .dt-total { color: #38bdf8; font-weight: 800; background: rgba(56, 189, 248, 0.05); }
    .dt .dt-zero { color: #475569; font-weight: 400; }
  `;

  if (loading) return (
    <Layout>
      <div style={{ textAlign: 'center', marginTop: '5rem', color: '#38bdf8' }}>
        <CircleNotch size={50} className="ph-spin" />
        <p style={{ marginTop: '15px', color: 'var(--text-muted)', fontWeight: 'bold' }}>Compiling Analytics & Matrices...</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <style>{reportStyles}</style>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0' }}>Live Analytics Reports</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Comprehensive tracking, matrices, and placement data.</p>
          </div>
          <div>
            <input type="month" className="sleek-input" style={{ background: '#0f1523', border: '1px solid #38bdf8', color: '#38bdf8', fontWeight: 'bold', fontSize: '1rem' }} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          </div>
        </div>

        <div className="rt-tabs">
          <button className={`rt-tab ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)}><Target size={20} weight={activeTab === 1 ? "fill" : "regular"} /> My Target Report</button>
          <button className={`rt-tab ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}><Buildings size={20} weight={activeTab === 2 ? "fill" : "regular"} /> Branch Matrices</button>
          <button className={`rt-tab ${activeTab === 3 ? 'active' : ''}`} onClick={() => setActiveTab(3)}><ChartLineUp size={20} weight={activeTab === 3 ? "fill" : "regular"} /> Placement Tracker</button>
          <button className={`rt-tab ${activeTab === 4 ? 'active' : ''}`} onClick={() => setActiveTab(4)}><ShieldCheck size={20} weight={activeTab === 4 ? "fill" : "regular"} /> TPO Activities</button>
        </div>

        {/* TAB 1 */}
        {activeTab === 1 && (
          <div className="hero-card fade-in">
            <div className="hc-header">
              <span>Placement Report</span>
              <span style={{ color: '#bae6fd' }}>{displayMonthName.toUpperCase()}</span>
            </div>
            
            <div className="hc-grid">
              <div className="hc-item"><div className="hc-label">Name of the Employee</div><div className="hc-value">{tpoData?.name || 'Officer'}</div></div>
              <div className="hc-item"><div className="hc-label">Sitting Branch</div><div className="hc-value">{tpoData?.sittingBranch || 'N/A'}</div></div>
              <div className="hc-item"><div className="hc-label">Emp ID</div><div className="hc-value">IPCS-EMP-{getHashId(tpoData?.email)}</div></div>
              <div className="hc-item"><div className="hc-label">Assigned Branches</div><div className="hc-value" style={{ fontSize: '0.85rem' }}>{(tpoData?.assignedBranchesArray || []).join(', ').toUpperCase()}</div></div>
              <div className="hc-item" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
                <div className="hc-label" style={{ color: '#10b981' }}>Target For The Month</div>
                <div className="hc-value" style={{ color: '#10b981', fontSize: '1.6rem' }}>{targetGoal}</div>
              </div>
            </div>

            <div className="hc-subheader"><Briefcase size={20} weight="fill" /> Current Status On Placements</div>
            
            <div className="hc-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
              {COURSES.concat(['Others']).map(c => (
                <div key={c} className="hc-item" style={{ textAlign: 'center' }}>
                  <div className="hc-label">{c}</div>
                  <div className="hc-value" style={{ fontSize: '1.8rem', color: myPlacementCounts[c] > 0 ? '#38bdf8' : '#475569' }}>{myPlacementCounts[c]}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#0f1523', padding: '20px 25px', borderTop: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Progress to Target</span>
                <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>{myTotalPlacements} / {targetGoal} Hires</span>
              </div>
              <div style={{ width: '100%', height: '12px', background: '#1e293b', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', background: progressPercent >= 100 ? '#10b981' : '#38bdf8', transition: 'width 1s ease-in-out' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2 */}
        {activeTab === 2 && (
          <div className="fade-in">
            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><UsersThree size={22} color="#f59e0b" weight="fill"/> Branchwise Student Enrollment</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>My Assigned Branches</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr><th>Branch Name</th>{COURSES.map(c => <th key={c}>{c}</th>)}<th>Others</th><th className="dt-total">Total Students</th></tr>
                  </thead>
                  <tbody>
                    {assignedBranches.length === 0 ? <tr><td colSpan="8" style={{textAlign:'center'}}>No students found in assigned branches.</td></tr> : 
                    assignedBranches.map(b => (
                      <tr key={`en-${b}`}>
                        <td>{b}</td>
                        {COURSES.concat(['Others']).map(c => <td key={c} className={branchEnrolls[b][c] === 0 ? 'dt-zero' : ''}>{branchEnrolls[b][c]}</td>)}
                        <td className="dt-total">{branchEnrolls[b].Total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Target size={22} color="#10b981" weight="fill"/> Branchwise Placement Matrix</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>All Branches • {displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr><th>Branch Name</th>{COURSES.map(c => <th key={c}>{c}</th>)}<th>Others</th><th className="dt-total" style={{ color: '#10b981' }}>Total Placed</th></tr>
                  </thead>
                  <tbody>
                    {allBranches.map(b => (
                      <tr key={`pl-${b}`}>
                        <td>{b}</td>
                        {COURSES.concat(['Others']).map(c => <td key={c} className={branchPlaces[b][c] === 0 ? 'dt-zero' : ''}>{branchPlaces[b][c]}</td>)}
                        <td className="dt-total" style={{ color: '#10b981' }}>{branchPlaces[b].Total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Buildings size={22} color="#8b5cf6" weight="fill"/> Branch vs TPO Status</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>All Branches • {displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr><th>Branch Name</th>{activeTPOs.map(t => <th key={t}>{t}</th>)}<th className="dt-total" style={{ color: '#8b5cf6' }}>Branch Total</th></tr>
                  </thead>
                  <tbody>
                    {allBranches.map(b => (
                      <tr key={`tpo-${b}`}>
                        <td>{b}</td>
                        {activeTPOs.map(t => <td key={t} className={branchTPO[b][t] === 0 ? 'dt-zero' : ''}>{branchTPO[b][t]}</td>)}
                        <td className="dt-total" style={{ color: '#8b5cf6' }}>{branchTPO[b].Total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3 */}
        {activeTab === 3 && (
          <div className="fade-in">
            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ChartLineUp size={22} color="#ec4899" weight="fill"/> Placement Data Tracking</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Course Name</th>
                      <th style={{ color: '#10b981' }}>Total Placed</th>
                      <th>Students Joined</th>
                      <th>Not Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COURSES.concat(['Others']).map(c => {
                      const d = pipeline[c];
                      return (
                        <tr key={`trk-${c}`}>
                          <td>{c}</td>
                          <td style={{ color: '#10b981', fontWeight: 'bold' }} className={d.placed === 0 ? 'dt-zero' : ''}>{d.placed}</td>
                          <td className={d.joined === 0 ? 'dt-zero' : ''}>{d.joined}</td>
                          <td className={d.notJoined === 0 ? 'dt-zero' : ''}>{d.notJoined}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><CircleNotch size={22} color="#f59e0b" weight="fill"/> Placement Pending Students</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>My Assigned Branches</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr><th>Branch Name</th>{COURSES.map(c => <th key={c}>{c}</th>)}<th>Others</th><th className="dt-total" style={{ color: '#f59e0b' }}>Total Pending</th></tr>
                  </thead>
                  <tbody>
                    {assignedBranches.length === 0 ? <tr><td colSpan="8" style={{textAlign:'center'}}>No pending students in assigned branches.</td></tr> : 
                    assignedBranches.map(b => (
                      <tr key={`pend-${b}`}>
                        <td>{b}</td>
                        {COURSES.concat(['Others']).map(c => <td key={c} className={pendingByCourse[b][c] === 0 ? 'dt-zero' : ''}>{pendingByCourse[b][c]}</td>)}
                        <td className="dt-total" style={{ color: '#f59e0b' }}>{pendingByCourse[b].Total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Briefcase size={22} color="#3b82f6" weight="fill"/> NewsLetter Jobs Created</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr>{COURSES.map(c => <th key={c}>{c}</th>)}<th>Others</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      {COURSES.concat(['Others']).map(c => <td key={c} className={newsLetterStats[c] === 0 ? 'dt-zero' : ''}>{newsLetterStats[c]}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4 */}
        {activeTab === 4 && (
          <div className="fade-in">
            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ShieldCheck size={22} color="#0ea5e9" weight="fill"/> Placement Officer Activities & Logs</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Placement Officer</th>
                      <th>Companies Visited</th>
                      <th>Drives Conducted</th>
                      <th>Videos Created</th>
                      <th>Posters Created</th>
                      <th style={{ color: '#10b981' }}>Total Joined</th>
                      <th style={{ color: '#ef4444' }}>Not Joining</th>
                      <th className="dt-total">Total Apps Handled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tpoActivity.length === 0 ? <tr><td colSpan="8" style={{textAlign:'center'}}>No TPO activities logged this month.</td></tr> : 
                    tpoActivity.map(t => (
                      <tr key={`act-${t.tpo}`}>
                        <td>{t.tpo}</td>
                        <td className={t.companiesVisited === 0 ? 'dt-zero' : ''}>{t.companiesVisited}</td>
                        <td className={t.drivesConducted === 0 ? 'dt-zero' : ''}>{t.drivesConducted}</td>
                        <td className={t.videosMade === 0 ? 'dt-zero' : ''}>{t.videosMade}</td>
                        <td className={t.postersMade === 0 ? 'dt-zero' : ''}>{t.postersMade}</td>
                        <td style={{ color: '#10b981', fontWeight: 'bold' }} className={t.joining === 0 ? 'dt-zero' : ''}>{t.joining}</td>
                        <td style={{ color: '#ef4444', fontWeight: 'bold' }} className={t.notJoining === 0 ? 'dt-zero' : ''}>{t.notJoining}</td>
                        <td className="dt-total">{t.totalApps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}