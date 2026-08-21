import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, FilePdf, Trophy, Buildings, PresentationChart, CheckCircle, WarningCircle, UserPlus, UsersThree } from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal.onrender.com";
const COURSES = ['Automation', 'BMS', 'IT', 'DM', 'Embedded'];

export default function Reports() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [loading, setLoading] = useState(true);

  // Global Month Filter (Defaults to Current Month)
  const currentMonthStr = new Date().toISOString().slice(0, 7); 
  const [monthFilter, setMonthFilter] = useState(currentMonthStr);

  const [students, setStudents] = useState([]);
  const [applications, setApplications] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!tpoData) return;
    const fetchAllData = async () => {
      try {
        const res = await axios.post(`${API_BASE}/api/tpo/reports`, { assignedBranchesArray: ['all'] });
        if (res.data.success) {
          setStudents(res.data.students);
          setApplications(res.data.applications);
          setVacancies(res.data.vacancies);
          setEvents(res.data.events);
        }
      } catch (error) { console.error("Failed to fetch reports", error); } finally { setLoading(false); }
    };
    fetchAllData();
  }, [tpoData]);

  // ==========================================
  // HELPERS
  // ==========================================
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
    if (!monthFilter || !dateStr) return false;
    let year, month;
    if (dateStr.includes('/')) {
      const parts = dateStr.split(' ')[0].split('/');
      year = parts[2]; month = parts[1];
    } else {
      const d = new Date(dateStr);
      if (isNaN(d)) return false;
      year = d.getFullYear(); month = String(d.getMonth() + 1).padStart(2, '0');
    }
    return `${year}-${month}` === monthFilter;
  };

  const isAssignedBranch = (b) => {
    if (tpoData.assignedBranchesArray.includes('all')) return true;
    return tpoData.assignedBranchesArray.some(assigned => (b || '').toLowerCase().includes(assigned.toLowerCase()));
  };

  if (loading) return (
    <Layout>
      <div style={{ textAlign: 'center', marginTop: '5rem', color: '#38bdf8' }}>
        <CircleNotch size={50} className="ph-spin" />
        <p style={{ marginTop: '15px', color: 'var(--text-muted)', fontWeight: 'bold' }}>Generating Executive Report...</p>
      </div>
    </Layout>
  );

  // ==========================================
  // 1. DATA AGGREGATION (Filtered by Month)
  // ==========================================
  const displayMonthName = new Date(monthFilter + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
  const tpoNameLower = (tpoData?.name || '').toLowerCase();

  // A. Placements & Applications
  const monthlyApps = applications.filter(a => checkMonth(a.date));
  const myMonthlyApps = monthlyApps.filter(a => (a.tpoName || '').toLowerCase() === tpoNameLower);
  
  const placedApps = [];
  const notJoinedApps = [];
  
  myMonthlyApps.forEach(a => {
    const stat = (a.status || '').toLowerCase();
    if (stat.includes('placed') || stat.includes('join') || stat.includes('offer')) placedApps.push(a);
    if (stat.includes('reject') || stat.includes('not join') || stat.includes('not attend')) notJoinedApps.push(a);
  });

  const totalPlacements = placedApps.length;

  // B. Dual & Multi Placement Logic
  const studentAppCounts = {};
  placedApps.forEach(a => {
    const key = a.roll || a.name;
    studentAppCounts[key] = (studentAppCounts[key] || 0) + 1;
  });

  let joinedCount = 0;
  let dualCount = 0;
  let multiCount = 0;

  const processedPlacedStudents = placedApps.map(a => {
    const key = a.roll || a.name;
    const count = studentAppCounts[key];
    const stat = (a.status || '').toLowerCase();
    
    let tag = 'Normal';
    let color = '#38bdf8'; // Default Blue-ish
    
    if (count === 2) { tag = 'Dual Placement'; color = '#f97316'; dualCount++; } // Orange
    else if (count > 2) { tag = 'Multi Placement'; color = '#3b82f6'; multiCount++; } // Blue
    else if (stat.includes('join')) { tag = 'Joined'; color = '#10b981'; joinedCount++; } // Green
    
    return { ...a, displayTag: tag, tagColor: color };
  });

  // Since dual/multi counts track total rows, divide to get distinct student instances if needed
  dualCount = dualCount / 2; 
  multiCount = Math.floor(multiCount / 3); // Approximation for >2

  // C. Placement Matrix (By Course)
  const myPlacementCourseCounts = { Automation: 0, BMS: 0, IT: 0, DM: 0, Embedded: 0, Others: 0 };
  placedApps.forEach(a => myPlacementCourseCounts[getCourse(a.course)]++);

  // D. Newsletter Matrix (Vacancies Created)
  const monthlyVacs = vacancies.filter(v => checkMonth(v.date));
  const myNewsletterCounts = { Automation: 0, BMS: 0, IT: 0, DM: 0, Embedded: 0, Others: 0, Total: 0 };
  const connectedCompanies = new Set();
  
  monthlyVacs.forEach(v => {
    myNewsletterCounts[getCourse(v.course)]++;
    myNewsletterCounts.Total++;
    if (v.company) connectedCompanies.add(v.company);
  });
  
  myMonthlyApps.forEach(a => { if (a.company) connectedCompanies.add(a.company); });

  // E. Highlights (Events & Drives)
  const monthlyEvents = events.filter(e => checkMonth(e.date));
  const driveCount = monthlyEvents.filter(e => (e.type || e.title || '').toLowerCase().includes('drive')).length;

  // F. Center-wise Placements (All TPOs)
  const branchPlaces = {};
  monthlyApps.forEach(a => {
    const stat = (a.status || '').toLowerCase();
    if (stat.includes('placed') || stat.includes('join') || stat.includes('offer')) {
      const b = a.branch || 'Unknown';
      const c = getCourse(a.course);
      if (!branchPlaces[b]) branchPlaces[b] = { Automation: 0, BMS: 0, IT: 0, DM: 0, Embedded: 0, Others: 0, Total: 0 };
      branchPlaces[b][c]++;
      branchPlaces[b].Total++;
    }
  });

  // G. TPO Wise Placement (Current TPO only)
  const myBranchPlaces = {};
  placedApps.forEach(a => {
    const b = a.branch || 'Unknown';
    myBranchPlaces[b] = (myBranchPlaces[b] || 0) + 1;
  });

  // H. Placement Awaiting (Assigned Branches only)
  const pendingByBranch = {};
  students.forEach(s => {
    if (isAssignedBranch(s.branch)) {
      const stat = (s.placementStatus || '').toLowerCase();
      if (stat.includes('pending') || stat === '') {
        const b = s.branch || 'Unknown';
        const c = getCourse(s.course);
        if (!pendingByBranch[b]) pendingByBranch[b] = { Automation: 0, BMS: 0, IT: 0, DM: 0, Embedded: 0, Others: 0, Total: 0 };
        pendingByBranch[b][c]++;
        pendingByBranch[b].Total++;
      }
    }
  });

  // ==========================================
  // STYLES
  // ==========================================
  const reportStyles = `
    .exec-report { background: #0f1523; color: #e2e8f0; font-family: Arial, sans-serif; padding: 40px; border-radius: 12px; border: 1px solid #1e293b; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
    .er-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #38bdf8; padding-bottom: 20px; margin-bottom: 30px; }
    .er-greeting { font-size: 1.1rem; line-height: 1.6; margin-bottom: 30px; }
    
    .er-section-title { font-size: 1.2rem; font-weight: bold; color: #38bdf8; margin: 30px 0 15px 0; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
    
    .er-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.9rem; background: #161e2e; }
    .er-table th { background: #1e293b; color: #fff; padding: 12px; text-align: left; font-weight: bold; border: 1px solid #334155; }
    .er-table td { padding: 10px 12px; border: 1px solid #334155; color: #cbd5e1; }
    .er-table .t-total { font-weight: bold; color: #fff; background: rgba(56, 189, 248, 0.1); }
    
    .status-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .ss-card { background: #161e2e; padding: 15px; border-radius: 8px; border: 1px solid #1e293b; border-left: 4px solid #38bdf8; }
    .ss-title { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
    .ss-value { font-size: 1.5rem; font-weight: bold; color: #fff; }
    
    .highlight-box { background: rgba(16, 185, 129, 0.05); border: 1px solid #10b981; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .highlight-box ul { margin: 0; padding-left: 20px; color: #a7f3d0; line-height: 1.8; }
  `;

  return (
    <Layout>
      <style>{reportStyles}</style>
      <div className="page-container" style={{ padding: 0 }}>
        
        {/* TOP CONTROLS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: '#161e2e', padding: '15px 25px', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: 0, color: '#fff' }}>Executive Report Generator</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>Auto-compiled monthly performance report.</p>
          </div>
          <div style={{ display: 'flex', gap: '15px' }}>
            <input type="month" className="sleek-input" style={{ background: '#0f1523', border: '1px solid #38bdf8', color: '#38bdf8' }} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
            <button className="btn-action" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => window.print()}>
              <FilePdf size={18} weight="fill" /> Export PDF
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* THE EXECUTIVE REPORT DOCUMENT              */}
        {/* ========================================== */}
        <div className="exec-report" id="printable-report">
          
          <div className="er-header">
            <div>
              <h1 style={{ margin: '0 0 5px 0', fontSize: '2rem', color: '#fff' }}>Monthly Report - {displayMonthName}</h1>
              <div style={{ color: 'var(--text-muted)' }}>From: {tpoData?.name} &lt;{tpoData?.email}&gt;</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981' }}>{totalPlacements}</div>
              <div style={{ color: '#a7f3d0', textTransform: 'uppercase', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '1px' }}>Total Placements</div>
            </div>
          </div>

          <div className="er-greeting">
            Hi Team,<br/><br/>
            Greetings of the day!<br/>
            I'm glad to share that I have successfully achieved <strong style={{color: '#10b981'}}>{totalPlacements} Placements</strong> for the month of {displayMonthName}.<br/>
            Please find the detailed placement report for the month below:
          </div>

          {/* HIGHLIGHTS */}
          <div className="er-section-title"><Trophy size={22} weight="fill" /> Highlights of the Month</div>
          <div className="highlight-box">
            <ul>
              <li>Conducted {driveCount} Placement Drive(s) across assigned branches.</li>
              <li>Connected with {connectedCompanies.size} companies to establish new collaborations and vacancies.</li>
              <li>Successfully secured placements for {joinedCount} students who have officially joined.</li>
            </ul>
          </div>

          {/* PLACEMENT & NEWSLETTER SUMMARY */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div>
              <div className="er-section-title" style={{ marginTop: 0 }}><PresentationChart size={20} weight="fill" /> Placement Status</div>
              <table className="er-table">
                <thead><tr>{COURSES.map(c => <th key={c}>{c}</th>)}<th className="t-total">Total</th></tr></thead>
                <tbody>
                  <tr>
                    {COURSES.map(c => <td key={c}>{myPlacementCourseCounts[c] || 0}</td>)}
                    <td className="t-total">{totalPlacements}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="er-section-title" style={{ marginTop: 0 }}><Briefcase size={20} weight="fill" /> Newsletter Status</div>
              <table className="er-table">
                <thead><tr><th>Auto</th><th>BMS</th><th>IT</th><th>DM</th><th>Other</th><th className="t-total">Total</th></tr></thead>
                <tbody>
                  <tr>
                    <td>{myNewsletterCounts.Automation}</td>
                    <td>{myNewsletterCounts.BMS}</td>
                    <td>{myNewsletterCounts.IT}</td>
                    <td>{myNewsletterCounts.DM}</td>
                    <td>{myNewsletterCounts.Embedded + myNewsletterCounts.Others}</td>
                    <td className="t-total">{myNewsletterCounts.Total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* PLACED STUDENTS DETAILS */}
          <div className="er-section-title"><UsersThree size={22} weight="fill" /> Placed Students Details</div>
          <table className="er-table">
            <thead>
              <tr><th>S.No</th><th>Name</th><th>Branch</th><th>Course</th><th>Company</th><th>Role</th><th>Package</th><th>Tag</th></tr>
            </thead>
            <tbody>
              {processedPlacedStudents.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>No placements recorded for this month yet.</td></tr>
              ) : (
                processedPlacedStudents.map((app, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 'bold', color: '#fff' }}>{app.name}</td>
                    <td>{app.branch}</td>
                    <td>{app.course}</td>
                    <td style={{ color: '#38bdf8' }}>{app.company}</td>
                    <td>{app.position || 'N/A'}</td>
                    <td>{app.packageLpa ? `${app.packageLpa} LPA` : 'N/A'}</td>
                    <td style={{ color: app.tagColor, fontWeight: 'bold' }}>{app.displayTag}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* STATUS SUMMARY COUNTS */}
          <div className="er-section-title"><CheckCircle size={22} weight="fill" /> Placement Status Breakdown</div>
          <div className="status-summary">
            <div className="ss-card" style={{ borderLeftColor: '#38bdf8' }}><div className="ss-title">Total Placed</div><div className="ss-value">{totalPlacements}</div></div>
            <div className="ss-card" style={{ borderLeftColor: '#10b981' }}><div className="ss-title">Students Joined</div><div className="ss-value">{joinedCount}</div></div>
            <div className="ss-card" style={{ borderLeftColor: '#ef4444' }}><div className="ss-title">Not Joined / Rejected</div><div className="ss-value">{notJoinedApps.length}</div></div>
            <div className="ss-card" style={{ borderLeftColor: '#f97316' }}><div className="ss-title">Dual Placements</div><div className="ss-value">{dualCount}</div></div>
            <div className="ss-card" style={{ borderLeftColor: '#3b82f6' }}><div className="ss-title">Multi Placements</div><div className="ss-value">{multiCount}</div></div>
          </div>

          {/* MATRICES: BRANCH TOTALS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div>
              <div className="er-section-title"><Buildings size={22} weight="fill" /> Center-wise Placement (All TPOs)</div>
              <table className="er-table">
                <thead><tr><th>Branch</th><th>Auto</th><th>BMS</th><th>IT</th><th>DM</th><th className="t-total">Total</th></tr></thead>
                <tbody>
                  {Object.keys(branchPlaces).length === 0 ? <tr><td colSpan="6" style={{textAlign:'center'}}>No Data</td></tr> : 
                    Object.keys(branchPlaces).sort().map(b => (
                    <tr key={`cw-${b}`}>
                      <td style={{ fontWeight: 'bold', color: '#fff' }}>{b}</td>
                      <td>{branchPlaces[b].Automation || 0}</td>
                      <td>{branchPlaces[b].BMS || 0}</td>
                      <td>{branchPlaces[b].IT || 0}</td>
                      <td>{branchPlaces[b].DM || 0}</td>
                      <td className="t-total">{branchPlaces[b].Total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="er-section-title"><UserPlus size={22} weight="fill" /> TPO Wise Placement (My Spread)</div>
              <table className="er-table">
                <thead><tr><th>Branch</th><th className="t-total">My Placements</th></tr></thead>
                <tbody>
                  {Object.keys(myBranchPlaces).length === 0 ? <tr><td colSpan="2" style={{textAlign:'center'}}>No Data</td></tr> : 
                    Object.keys(myBranchPlaces).sort().map(b => (
                    <tr key={`tw-${b}`}>
                      <td style={{ fontWeight: 'bold', color: '#fff' }}>{b}</td>
                      <td className="t-total">{myBranchPlaces[b]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PLACEMENT AWAITING LIST */}
          <div className="er-section-title"><WarningCircle size={22} weight="fill" /> Placement Awaiting List (My Branches)</div>
          <table className="er-table">
            <thead>
              <tr><th>Branch</th><th>Automation</th><th>BMS</th><th>IT</th><th>DM</th><th>Embedded/Others</th><th className="t-total">Total Pending</th></tr>
            </thead>
            <tbody>
              {Object.keys(pendingByBranch).length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No pending students in assigned branches.</td></tr>
              ) : (
                Object.keys(pendingByBranch).sort().map(b => (
                  <tr key={`pa-${b}`}>
                    <td style={{ fontWeight: 'bold', color: '#fff' }}>{b}</td>
                    <td>{pendingByBranch[b].Automation || 0}</td>
                    <td>{pendingByBranch[b].BMS || 0}</td>
                    <td>{pendingByBranch[b].IT || 0}</td>
                    <td>{pendingByBranch[b].DM || 0}</td>
                    <td>{(pendingByBranch[b].Embedded || 0) + (pendingByBranch[b].Others || 0)}</td>
                    <td className="t-total" style={{ color: '#ef4444' }}>{pendingByBranch[b].Total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* SIGNATURE FOOTER */}
          <div style={{ marginTop: '50px', borderTop: '1px solid #1e293b', paddingTop: '20px', fontSize: '0.9rem', color: '#94a3b8' }}>
            Thank you all for your continuous support throughout.<br/>
            Feel free to let me know if any additional details are required from my end.<br/><br/>
            <strong style={{ color: '#fff', fontSize: '1rem' }}>{tpoData?.name}</strong><br/>
            PLACEMENT OFFICER<br/>
            IPCS GLOBAL<br/>
            {tpoData?.email}
          </div>

        </div>
      </div>
    </Layout>
  );
}