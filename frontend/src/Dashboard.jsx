import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Trophy, CircleNotch, TrendUp, 
  CalendarCheck, CalendarBlank, ChartBar, Desktop, NotePencil, ListChecks
} from '@phosphor-icons/react';
import Layout from './Layout';

export default function Dashboard() {
  const navigate = useNavigate();
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  
  const [stats, setStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0 });
  const [events, setEvents] = useState([]);
  const [recentPlacements, setRecentPlacements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reqPayload = { assignedBranchesArray: tpoData.assignedBranchesArray, role: tpoData.role, assignedCourse: tpoData.assignedCourse };
        const [statsRes, appsRes] = await Promise.all([
          axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/dashboard-stats', reqPayload),
          axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications', { ...reqPayload, tpoName: tpoData.name })
        ]);
        
        if (statsRes.data.success) {
          setStats(statsRes.data.stats);
          setEvents(statsRes.data.events || []);
        }
        if (appsRes.data.success) {
          const placed = appsRes.data.applications.filter(a => {
            const s = (a.status || '').toLowerCase();
            const j = (a.joiningStatus || '').toLowerCase();
            return s.includes('placed') || s.includes('got offer') || s.includes('join') || s.includes('offer') || j.includes('join');
          }).reverse().slice(0, 5);
          setRecentPlacements(placed);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    if (tpoData) fetchData();
  }, [tpoData]);

  const placementRate = stats.totalStudents > 0 ? ((stats.placed / stats.totalStudents) * 100).toFixed(1) : '0.0';

  // ==========================================
  // NATIVE SVG CHARTS (Mockup Matched)
  // ==========================================
  
  // 1. Sparklines for KPI Cards
  const makeSparkline = (color) => {
    const pts = Array.from({length: 10}, () => Math.floor(Math.random() * 20));
    const path = `M 0,${pts[0]} ` + pts.map((p, i) => `L ${i * 12},${p}`).join(' ');
    return (
      <svg width="100%" height="30" viewBox="0 0 108 25" preserveAspectRatio="none" style={{ marginTop: '10px' }}>
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`${path} L 108,25 L 0,25 Z`} fill={color} opacity="0.1" />
      </svg>
    );
  };

  // 2. Main 3-Line Trend Chart
  const trendData = [
    { m: 'Jan', apps: 80, off: 40, pl: 20 }, { m: 'Feb', apps: 60, off: 30, pl: 15 }, { m: 'Mar', apps: 130, off: 60, pl: 40 },
    { m: 'Apr', apps: 150, off: 90, pl: 60 }, { m: 'May', apps: 110, off: 70, pl: 45 }, { m: 'Jun', apps: 160, off: 120, pl: 80 },
    { m: 'Jul', apps: 190, off: 160, pl: 100 }, { m: 'Aug', apps: 140, off: 130, pl: 70 }, { m: 'Sep', apps: 200, off: 170, pl: 120 },
    { m: 'Oct', apps: 190, off: 150, pl: 110 }, { m: 'Nov', apps: 240, off: 210, pl: 140 }, { m: 'Dec', apps: 210, off: 180, pl: 130 }
  ];
  const cHeight = 140; const cWidth = 600; const maxV = 250; const xStep = cWidth / 11;
  const makeSmoothPath = (key) => {
    let path = `M 0,${cHeight - (trendData[0][key]/maxV*cHeight)}`;
    for(let i=0; i<11; i++) {
      const cx = (i * xStep + (i+1) * xStep)/2;
      path += ` C ${cx},${cHeight - (trendData[i][key]/maxV*cHeight)} ${cx},${cHeight - (trendData[i+1][key]/maxV*cHeight)} ${(i+1)*xStep},${cHeight - (trendData[i+1][key]/maxV*cHeight)}`;
    } return path;
  };

  // 3. Donut Chart
  const domainData = [ { n: 'Software', v: 439, c: '#3b82f6' }, { n: 'Data Science', v: 251, c: '#10b981' }, { n: 'Digital Mkt', v: 188, c: '#8b5cf6' }, { n: 'Embedded', v: 126, c: '#f59e0b' }, { n: 'UI/UX', v: 126, c: '#ec4899' } ];
  const totalDomain = domainData.reduce((acc, curr) => acc + curr.v, 0);
  let cumPct = 0; const circ = 2 * Math.PI * 40;

  // Render Mini Calendar
  const renderCalendar = () => {
    const days = [27,28,29,30,1,2,3, 4,5,6,7,8,9,10, 11,12,13,14,15,16,17, 18,19,20,21,22,23,24, 25,26,27,28,29,30,31];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontSize: '0.75rem', marginTop: '15px' }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>{d}</div>)}
        {days.map((d, i) => (
          <div key={i} style={{ padding: '4px', color: (i<4) ? '#475569' : '#fff', background: d===15 ? '#3b82f6' : d===28 ? '#10b981' : 'transparent', borderRadius: '50%', fontWeight: (d===15||d===28) ? 'bold' : 'normal' }}>{d}</div>
        ))}
      </div>
    );
  };

  return (
    <div className="db-wrapper" style={{ paddingBottom: '40px' }}>
      
      {/* ROW 1: TOP 6 KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        
        <div className="dash-card">
          <div className="kpi-header">
            <div className="icon-c blue"><Users weight="fill" size={20}/></div>
            <div>
              <div className="kpi-title">Total Students</div>
              <div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.totalStudents}</div>
            </div>
          </div>
          <div className="kpi-trend green">↑ 12.5% vs last month</div>
          {makeSparkline('#3b82f6')}
        </div>

        <div className="dash-card">
          <div className="kpi-header">
            <div className="icon-c green"><Briefcase weight="fill" size={20}/></div>
            <div>
              <div className="kpi-title">Active Vacancies</div>
              <div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.activeVacancies}</div>
            </div>
          </div>
          <div className="kpi-trend green">↑ 18.3% vs last month</div>
          {makeSparkline('#10b981')}
        </div>

        <div className="dash-card">
          <div className="kpi-header">
            <div className="icon-c purple"><Trophy weight="fill" size={20}/></div>
            <div>
              <div className="kpi-title">Students Placed</div>
              <div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.placed}</div>
            </div>
          </div>
          <div className="kpi-trend green">↑ 16.7% vs last month</div>
          {makeSparkline('#a855f7')}
        </div>

        <div className="dash-card">
          <div className="kpi-header">
            <div className="icon-c orange"><ChartBar weight="fill" size={20}/></div>
            <div>
              <div className="kpi-title">Placement Rate</div>
              <div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : `${placementRate}%`}</div>
            </div>
          </div>
          <div className="kpi-trend green">↑ 6.4% vs last month</div>
          {makeSparkline('#f59e0b')}
        </div>

        <div className="dash-card">
          <div className="kpi-header">
            <div className="icon-c pink"><CalendarCheck weight="fill" size={20}/></div>
            <div>
              <div className="kpi-title">Upcoming Drives</div>
              <div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : '23'}</div>
            </div>
          </div>
          <div className="kpi-trend green">↑ 9.1% vs last month</div>
          {makeSparkline('#ec4899')}
        </div>

        <div className="dash-card">
          <div className="kpi-header">
            <div className="icon-c teal"><ListChecks weight="fill" size={20}/></div>
            <div>
              <div className="kpi-title">Active MOUs</div>
              <div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : '68'}</div>
            </div>
          </div>
          <div className="kpi-trend green">↑ 10.2% vs last month</div>
          {makeSparkline('#0ea5e9')}
        </div>

      </div>

      {/* ROW 2: MAIN CHARTS */}
      <div className="grid-3-col" style={{ marginBottom: '20px' }}>
        
        {/* Placement Overview Chart */}
        <div className="dash-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-top">
            <h3>Placement Overview</h3>
            <select className="mini-select"><option>This Year</option></select>
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '20px' }}>
            <span style={{ color: '#3b82f6' }}>— Offers</span>
            <span style={{ color: '#10b981' }}>— Placements</span>
            <span style={{ color: '#a855f7' }}>— Applications</span>
          </div>
          
          <div style={{ height: `${cHeight}px`, width: '100%', position: 'relative' }}>
            <svg viewBox={`0 0 ${cWidth} ${cHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {[0, 1, 2, 3, 4].map(i => <line key={i} x1="0" y1={cHeight * (i/4)} x2={cWidth} y2={cHeight * (i/4)} stroke="#1e293b" />)}
              <path d={makeSmoothPath('apps')} fill="none" stroke="#a855f7" strokeWidth="3" />
              <path d={makeSmoothPath('off')} fill="none" stroke="#3b82f6" strokeWidth="3" />
              <path d={makeSmoothPath('pl')} fill="none" stroke="#10b981" strokeWidth="3" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', color: '#64748b', fontSize: '0.7rem' }}>
              {trendData.map(d => <span key={d.m}>{d.m}</span>)}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: '15px', marginTop: '20px' }}>
            <div><div className="stat-lbl">Total Applications</div><div className="stat-val">3,842</div></div>
            <div><div className="stat-lbl">Total Offers</div><div className="stat-val">1,842</div></div>
            <div><div className="stat-lbl">Total Placements</div><div className="stat-val">1,256</div></div>
            <div><div className="stat-lbl">Highest Package</div><div className="stat-val">18.5 LPA</div></div>
            <div><div className="stat-lbl">Average Package</div><div className="stat-val">4.6 LPA</div></div>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="dash-card">
          <h3>Placements by Domain</h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
            <div style={{ width: '160px', height: '160px', position: 'relative' }}>
              <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                {domainData.map(slice => {
                  const pct = slice.v / totalDomain; const dash = `${pct * circ} ${circ}`; const off = cumPct * circ * -1; cumPct += pct;
                  return <circle key={slice.n} r={40} cx="50" cy="50" fill="transparent" stroke={slice.c} strokeWidth="16" strokeDasharray={dash} strokeDashoffset={off} />
                })}
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>1,256</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Total Placements</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {domainData.map(d => (
              <div key={d.n} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}><span style={{ width: '8px', height: '8px', background: d.c }}></span>{d.n}</div>
                <div style={{ color: '#64748b' }}>{((d.v/totalDomain)*100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ROW 3: TABLES & CALENDAR */}
      <div className="grid-3-col" style={{ marginBottom: '20px' }}>
        
        {/* Recent Placements */}
        <div className="dash-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-top">
            <h3>Recent Placement Activity</h3>
            <button className="text-link" onClick={()=>navigate('/placed')}>View All</button>
          </div>
          <table className="mini-table">
            <thead>
              <tr><th>Student</th><th>Company</th><th>Role</th><th style={{textAlign:'right'}}>Package</th><th style={{textAlign:'right'}}>Status</th></tr>
            </thead>
            <tbody>
              {recentPlacements.length > 0 ? recentPlacements.map((p, i) => (
                <tr key={i}>
                  <td><div style={{display:'flex', alignItems:'center', gap:'8px'}}><div className="tiny-avatar">{p.name.charAt(0)}</div> <span style={{color:'#fff'}}>{p.name}</span></div></td>
                  <td><span style={{color:'#3b82f6', fontWeight:'bold'}}>{p.company}</span></td>
                  <td>{p.course}</td>
                  <td style={{textAlign:'right', fontWeight:'bold', color:'#fff'}}>{p.packageLpa ? `${p.packageLpa} LPA` : '-'}</td>
                  <td style={{textAlign:'right'}}><span className="status-badge green">Placed</span></td>
                </tr>
              )) : <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>No records found</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Global Calendar */}
        <div className="dash-card">
          <div className="card-top">
            <h3>Global Calendar</h3>
            <button className="text-link" onClick={()=>navigate('/events')}>View All</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>
            <span>&lt;</span><span>May 2026</span><span>&gt;</span>
          </div>
          {renderCalendar()}
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ fontSize:'0.75rem', fontWeight:'bold', color:'#cbd5e1' }}>May 15</div>
              <div><div style={{fontSize:'0.8rem', color:'#fff', fontWeight:'bold'}}>TCS Online Drive</div><div style={{fontSize:'0.65rem', color:'#64748b'}}>10:00 AM - Online</div></div>
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ fontSize:'0.75rem', fontWeight:'bold', color:'#cbd5e1' }}>May 17</div>
              <div><div style={{fontSize:'0.8rem', color:'#fff', fontWeight:'bold'}}>Infosys Technical Round</div><div style={{fontSize:'0.65rem', color:'#64748b'}}>09:30 AM - Bangalore</div></div>
            </div>
          </div>
        </div>

      </div>

      {/* ROW 4: BATCH PROGRESS & ANNOUNCEMENTS & QUICK LINKS */}
      <div className="grid-3-col" style={{ marginBottom: '30px' }}>
        
        {/* Quick Access */}
        <div className="dash-card">
          <h3>Quick Access</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '15px' }}>
            <div className="qa-box"><div className="qa-icon blue"><CalendarCheck weight="fill"/></div>Add Drive</div>
            <div className="qa-box"><div className="qa-icon blue"><Users weight="fill"/></div>Add Student</div>
            <div className="qa-box"><div className="qa-icon green"><ListChecks weight="fill"/></div>Interview</div>
            <div className="qa-box"><div className="qa-icon orange"><NotePencil weight="fill"/></div>Create Exam</div>
            <div className="qa-box"><div className="qa-icon pink"><BookOpen weight="fill"/></div>Material</div>
            <div className="qa-box"><div className="qa-icon teal"><ChartBar weight="fill"/></div>Gen. Report</div>
            <div className="qa-box"><div className="qa-icon purple"><Desktop weight="fill"/></div>View Reports</div>
          </div>
        </div>

        {/* Batch Progress */}
        <div className="dash-card">
          <div className="card-top">
            <h3>Batch Progress Overview</h3>
            <button className="text-link" onClick={()=>navigate('/courses')}>View All</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
            {batchProgress.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.75rem' }}>
                <div style={{ width: '130px', color: '#cbd5e1' }}>{b.batch}</div>
                <div style={{ flex: 1, height: '4px', background: '#1e293b', borderRadius: '2px' }}>
                  <div style={{ width: `${b.progress}%`, height: '100%', background: b.color }}></div>
                </div>
                <div style={{ width: '30px', textAlign: 'right', fontWeight: 'bold' }}>{b.progress}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Announcements */}
        <div className="dash-card">
          <div className="card-top">
            <h3>Announcements</h3>
            <button className="text-link" onClick={()=>navigate('/events')}>View All</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '8px', borderRadius: '8px' }}><CalendarStar weight="fill" size={16}/></div>
              <div><div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold' }}>New Placement Drive from Cognizant</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>Hiring for multiple roles. Apply now! • 2h ago</div></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '8px', borderRadius: '8px' }}><NotePencil weight="fill" size={16}/></div>
              <div><div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold' }}>Aptitude Exam Scheduled</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>Quantitative Aptitude on May 18. • 5h ago</div></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '8px', borderRadius: '8px' }}><BookOpen weight="fill" size={16}/></div>
              <div><div style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold' }}>Update: New Study Materials</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>Advanced Java Notes uploaded. • 1d ago</div></div>
            </div>
          </div>
        </div>

      </div>

      {/* ROW 5: SYSTEM OVERVIEW & DRIVE PIPELINE */}
      <div className="grid-2-col">
        
        <div className="dash-card">
          <h3>System Overview</h3>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px', textAlign: 'center' }}>
            <div><div style={{ color: '#3b82f6', marginBottom: '5px' }}><BuildingOffice size={24}/></div><div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>32</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>Branches</div></div>
            <div><div style={{ color: '#a855f7', marginBottom: '5px' }}><ChalkboardTeacher size={24}/></div><div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>156</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>Trainers</div></div>
            <div><div style={{ color: '#f59e0b', marginBottom: '5px' }}><Files size={24}/></div><div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>8,421</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>Resources</div></div>
            <div><div style={{ color: '#10b981', marginBottom: '5px' }}><ShieldCheck size={24}/></div><div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>99.9%</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>System Uptime</div></div>
          </div>
        </div>

        <div className="dash-card">
          <div className="card-top">
            <h3>Drive Pipeline</h3>
            <button className="text-link" onClick={()=>navigate('/placement-drives')}>View Pipeline →</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', textAlign: 'center' }}>
            <div><div style={{ fontSize: '0.7rem', color: '#f59e0b', marginBottom: '5px' }}>● Upcoming</div><div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>23</div></div>
            <div style={{ color: '#334155' }}>→</div>
            <div><div style={{ fontSize: '0.7rem', color: '#10b981', marginBottom: '5px' }}>● Registration</div><div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>912</div></div>
            <div style={{ color: '#334155' }}>→</div>
            <div><div style={{ fontSize: '0.7rem', color: '#a855f7', marginBottom: '5px' }}>● Shortlisted</div><div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>312</div></div>
            <div style={{ color: '#334155' }}>→</div>
            <div><div style={{ fontSize: '0.7rem', color: '#3b82f6', marginBottom: '5px' }}>● Interview</div><div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>156</div></div>
            <div style={{ color: '#334155' }}>→</div>
            <div><div style={{ fontSize: '0.7rem', color: '#ec4899', marginBottom: '5px' }}>● Offers</div><div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>98</div></div>
          </div>
        </div>

      </div>

      <style>{`
        .db-wrapper { font-family: 'Inter', sans-serif; }
        .dash-card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; }
        .dash-card h3 { margin: 0; font-size: 1rem; color: #fff; }
        
        .kpi-header { display: flex; align-items: center; gap: 15px; }
        .icon-c { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .icon-c.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .icon-c.green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .icon-c.purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
        .icon-c.orange { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .icon-c.pink { background: rgba(236, 72, 153, 0.1); color: #ec4899; }
        .icon-c.teal { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; }
        
        .kpi-title { font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px; }
        .kpi-val { font-size: 1.5rem; font-weight: bold; color: #fff; }
        .kpi-trend { font-size: 0.7rem; margin-top: 10px; font-weight: bold; }
        .kpi-trend.green { color: #10b981; }

        .grid-3-col { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 20px; }
        .grid-2-col { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; }
        @media (max-width: 1100px) { .grid-3-col, .grid-2-col { grid-template-columns: 1fr; } }

        .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .mini-select { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; border-radius: 6px; padding: 4px 8px; font-size: 0.75rem; outline: none; }
        .stat-lbl { font-size: 0.7rem; color: #64748b; margin-bottom: 4px; }
        .stat-val { font-size: 1.1rem; font-weight: bold; color: #fff; }

        .mini-table th { border-bottom: 1px solid #1e293b; color: #64748b; font-size: 0.75rem; padding-bottom: 10px; font-weight: normal; }
        .mini-table td { padding: 12px 0; border-bottom: 1px solid #1e293b; font-size: 0.85rem; color: #cbd5e1; }
        .tiny-avatar { width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; }
        .status-badge.green { background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; }

        .text-link { background: transparent; border: none; color: #3b82f6; font-size: 0.8rem; cursor: pointer; font-weight: bold; }
        .text-link:hover { text-decoration: underline; }

        .qa-box { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; font-size: 0.7rem; color: #cbd5e1; font-weight: bold; }
        .qa-icon { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #1e293b; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.2s; }
        .qa-box:hover .qa-icon { border-color: #3b82f6; transform: translateY(-2px); }
        .qa-icon.blue { color: #3b82f6; } .qa-icon.green { color: #10b981; } .qa-icon.orange { color: #f59e0b; } .qa-icon.pink { color: #ec4899; } .qa-icon.teal { color: #0ea5e9; } .qa-icon.purple { color: #a855f7; }
      `}</style>
    </div>
  );
}