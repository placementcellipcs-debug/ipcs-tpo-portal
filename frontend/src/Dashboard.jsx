import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Files, Trophy, CalendarStar, CircleNotch, 
  Buildings, BookOpen, Clock, NotePencil, Desktop, FolderOpen,
  CalendarCheck, ListChecks, ArrowRight, ChartBar
} from '@phosphor-icons/react';
import Layout from './Layout';

export default function Dashboard() {
  const navigate = useNavigate();
  
  let tpoData = null;
  try {
    const rawData = localStorage.getItem('tpoData');
    if (rawData) tpoData = JSON.parse(rawData);
  } catch(e) {
    console.error("Error reading tpoData");
  }
  
  const userRole = (tpoData?.role || '').toUpperCase();
  const isSuperAdmin = tpoData?.accessType === 'superadmin' || userRole.includes('ADMIN') || userRole.includes('HEAD') || userRole.includes('MANAGER');
  const showReports = isSuperAdmin || userRole === 'TPO';
  
  const [stats, setStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0 });
  const [events, setEvents] = useState([]);
  const [recentPlacements, setRecentPlacements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [trendData, setTrendData] = useState(Array(12).fill({ m: '', apps: 0, off: 0, pl: 0 }));
  const [domainData, setDomainData] = useState([]);
  const [pipeline, setPipeline] = useState({ applied: 0, interview: 0, offers: 0, placed: 0 });
  const [totalAppsCount, setTotalAppsCount] = useState(0);

  const parseDateRobust = (dStr) => {
    if (!dStr) return null;
    let cleanStr = typeof dStr === 'string' ? dStr.split(' ')[0].replace(/st|nd|rd|th/g, '') : dStr;
    if (typeof cleanStr === 'string' && (cleanStr.includes('/') || cleanStr.includes('-'))) {
      const parts = cleanStr.split(/[/-]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
      }
    }
    const d = new Date(cleanStr);
    return isNaN(d) ? null : d;
  };

  // 🚨 STANDARD DOMAIN MAPPER
  const getStandardDomain = (courseStr) => {
    if (!courseStr) return 'Other Domains';
    const c = courseStr.toLowerCase();
    if (c.includes('automation') || c.includes('plc') || c.includes('scada')) return 'Industrial Automation';
    if (c.includes('bms') || c.includes('cctv')) return 'BMS & CCTV';
    if (c.includes('embed') || c.includes('iot')) return 'Embedded & IoT';
    if (c.includes('digital') || c.includes('dm') || c.includes('marketing')) return 'Digital Marketing';
    if (c.includes('python') || c.includes('data') || c.includes('it') || c.includes('software')) return 'Data Science & IT';
    return 'Other Domains';
  };

  const processApps = (tpoLogs) => {
    const mappedLogs = tpoLogs.map(row => {
      const getVal = (s) => {
        const key = Object.keys(row).find(k => k.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, '')));
        return key ? row[key] : '';
      };
      return {
        name: getVal('studentname') || getVal('name'),
        roll: getVal('roll'),
        company: getVal('company'),
        course: getVal('course'),
        status: getVal('status') || 'Applied',
        date: getVal('dateplaced') || getVal('timestamp'),
        packageLpa: getVal('package'),
        joiningStatus: getVal('joiningstatus')
      };
    });

    const deduped = {};
    mappedLogs.forEach(log => {
      const key = `${log.roll || log.name}_${log.company}`.toLowerCase();
      // Ensure we don't accidentally overwrite a 'placed' status with an older 'applied' log
      if (!deduped[key] || (log.status.toLowerCase().includes('placed') || log.status.toLowerCase().includes('offer'))) {
        deduped[key] = log;
      }
    });
    const uniqueApps = Object.values(deduped);

    setTotalAppsCount(uniqueApps.length);
    const currentYear = new Date().getFullYear();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    
    // 🚨 RESET TREND PROPERLY TO AVOID OVERLAPPING LINES
    let newTrend = months.map(m => ({ m, apps: 0, off: 0, pl: 0 }));
    let domCount = {};
    let pApp = 0, pInt = 0, pOff = 0, pPl = 0;
    const placedRecent = [];

    uniqueApps.forEach(app => {
      const st = (app.status || '').toLowerCase();
      const jSt = (app.joiningStatus || '').toLowerCase();
      
      const isPlaced = st.includes('placed') || st.includes('got offer') || st.includes('offer') || jSt.includes('join');
      const isOffer = st.includes('offer') || isPlaced; // If placed, they had an offer
      const isInterview = st.includes('interview') || st.includes('shortlist');
      
      if (isPlaced) placedRecent.push(app);

      // Pipeline Aggregation
      if (st.includes('applied') || st.includes('register') || st.includes('pending')) pApp++;
      if (isInterview) pInt++;
      if (st.includes('offer')) pOff++;
      if (isPlaced) pPl++;

      // 🚨 MAPPING ALL SUBCOURSES TO 5 MAIN DOMAINS
      if (isPlaced) {
        let c = getStandardDomain(app.course);
        domCount[c] = (domCount[c] || 0) + 1;
      }

      const d = parseDateRobust(app.date);
      if (d && d.getFullYear() === currentYear) {
        const mIdx = d.getMonth();
        // Graph Metric Logic: 
        // 1. ALL entries count towards "Applications"
        // 2. Only those with Offer/Placed count towards "Offers"
        // 3. Only final Placed count towards "Placed"
        newTrend[mIdx].apps++;
        if (isOffer) newTrend[mIdx].off++;
        if (isPlaced) newTrend[mIdx].pl++;
      }
    });

    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9'];
    const formattedDomains = Object.keys(domCount).map((k, i) => ({
      n: k, v: domCount[k], c: colors[i % colors.length]
    })).sort((a,b) => b.v - a.v).slice(0, 5); 

    setTrendData(newTrend);
    setDomainData(formattedDomains);
    setPipeline({ applied: pApp, interview: pInt, offers: pOff, placed: pPl });
    
    const sortedRecent = placedRecent.sort((a, b) => {
      return new Date(parseDateRobust(b.date) || 0) - new Date(parseDateRobust(a.date) || 0);
    }).slice(0, 5);
    setRecentPlacements(sortedRecent);
  };

  useEffect(() => {
    const localTpoStr = localStorage.getItem('tpoData');
    if (!localTpoStr) return;
    const localTpo = JSON.parse(localTpoStr);

    const fetchData = async () => {
      const cachedStats = localStorage.getItem('dash_stats');
      const cachedLogs = localStorage.getItem('dash_logs');
      if (cachedStats) setStats(JSON.parse(cachedStats));
      if (cachedLogs) { processApps(JSON.parse(cachedLogs)); setLoading(false); }

      try {
        const reqPayload = { 
          assignedBranchesArray: localTpo.assignedBranchesArray, 
          role: localTpo.role, 
          assignedCourse: localTpo.assignedCourse, 
          tpoName: localTpo.name 
        };
        
        const [statsRes, reportsRes] = await Promise.all([
          axios.post('https://api-talenzo.ipcsglobal.info/api/tpo/dashboard-stats', reqPayload),
          axios.post('https://api-talenzo.ipcsglobal.info/api/tpo/reports', reqPayload)
        ]);
        
        if (statsRes.data.success) {
          setStats(statsRes.data.stats);
          localStorage.setItem('dash_stats', JSON.stringify(statsRes.data.stats));
          setEvents(statsRes.data.events || []);
        }

        if (reportsRes.data.success) {
          const logs = reportsRes.data.tpoLogs || [];
          localStorage.setItem('dash_logs', JSON.stringify(logs));
          processApps(logs);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchData();
  }, []); 

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const upcomingEvents = events.filter(e => {
    if (!e.date || !e.title || e.title.toLowerCase().includes('dummy')) return false;
    const pd = parseDateRobust(e.date);
    return pd && pd >= today;
  }).slice(0, 3);
  const upDrivesCount = events.filter(e => (e.type||'').toLowerCase().includes('drive') && parseDateRobust(e.date) >= today).length;

  const placementRate = stats.totalStudents > 0 ? ((stats.placed / stats.totalStudents) * 100).toFixed(1) : '0.0';

  const makeSparkline = (color) => {
    const staticPath = "M 0,15 L 12,12 L 24,18 L 36,10 L 48,16 L 60,8 L 72,14 L 84,6 L 96,12 L 108,4";
    return (
      <svg width="100%" height="30" viewBox="0 0 108 25" preserveAspectRatio="none" style={{ marginTop: '10px' }}>
        <path d={staticPath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`${staticPath} L 108,25 L 0,25 Z`} fill={color} opacity="0.1" />
      </svg>
    );
  };

  const cHeight = 140; const cWidth = 600; const xStep = cWidth / 11;
  const maxV = Math.max(...trendData.map(d => Math.max(d.apps, d.off, d.pl)), 10); 
  
  const makeSmoothPath = (key) => {
    if(!trendData.length) return '';
    let path = `M 0,${cHeight - (trendData[0][key]/maxV*cHeight)}`;
    for(let i=0; i<11; i++) {
      const cx = (i * xStep + (i+1) * xStep)/2;
      path += ` C ${cx},${cHeight - (trendData[i][key]/maxV*cHeight)} ${cx},${cHeight - (trendData[i+1][key]/maxV*cHeight)} ${(i+1)*xStep},${cHeight - (trendData[i+1][key]/maxV*cHeight)}`;
    } return path;
  };

  const totalDomain = domainData.reduce((acc, curr) => acc + curr.v, 0);
  let cumPct = 0; const circ = 2 * Math.PI * 40;

  const renderCalendar = () => {
    const days = [27,28,29,30,1,2,3, 4,5,6,7,8,9,10, 11,12,13,14,15,16,17, 18,19,20,21,22,23,24, 25,26,27,28,29,30,31];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontSize: '0.75rem', marginTop: '15px' }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>{d}</div>)}
        {days.map((d, i) => (
          <div key={i} style={{ padding: '4px', color: (i<4) ? '#475569' : '#fff', background: d===today.getDate() && i>3 && i<34 ? '#3b82f6' : 'transparent', borderRadius: '50%', fontWeight: d===today.getDate() ? 'bold' : 'normal' }}>{d}</div>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="db-wrapper" style={{ paddingBottom: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', color: '#fff' }}>Good Morning, {tpoData?.name?.split(' ')[0] || 'Officer'} 👋</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Here's what's happening across your branches today.</p>
          </div>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px 20px', borderRadius: '30px', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={16} /> {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div className="dash-card">
            <div className="kpi-header"><div className="icon-c blue"><Users weight="fill" size={20}/></div><div><div className="kpi-title">Total Students</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.totalStudents}</div></div></div>
            <div className="kpi-trend green">↑ Live Database</div>{makeSparkline('#3b82f6')}
          </div>
          <div className="dash-card">
            <div className="kpi-header"><div className="icon-c green"><Briefcase weight="fill" size={20}/></div><div><div className="kpi-title">Active Vacancies</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.activeVacancies}</div></div></div>
            <div className="kpi-trend green">↑ Hiring Now</div>{makeSparkline('#10b981')}
          </div>
          <div className="dash-card">
            <div className="kpi-header"><div className="icon-c purple"><Trophy weight="fill" size={20}/></div><div><div className="kpi-title">Students Placed</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.placed}</div></div></div>
            <div className="kpi-trend green">↑ Growing Pipeline</div>{makeSparkline('#a855f7')}
          </div>
          <div className="dash-card">
            <div className="kpi-header"><div className="icon-c orange"><ChartBar weight="fill" size={20}/></div><div><div className="kpi-title">Placement Rate</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : `${placementRate}%`}</div></div></div>
            <div className="kpi-trend green">↑ Global Average</div>{makeSparkline('#f59e0b')}
          </div>
          <div className="dash-card">
            <div className="kpi-header"><div className="icon-c pink"><CalendarCheck weight="fill" size={20}/></div><div><div className="kpi-title">Upcoming Drives</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : upDrivesCount}</div></div></div>
            <div className="kpi-trend green">↑ Scheduled Events</div>{makeSparkline('#ec4899')}
          </div>
          <div className="dash-card">
            <div className="kpi-header"><div className="icon-c teal"><ListChecks weight="fill" size={20}/></div><div><div className="kpi-title">Total Applications</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : totalAppsCount}</div></div></div>
            <div className="kpi-trend green">↑ Submitted</div>{makeSparkline('#0ea5e9')}
          </div>
        </div>

        <div className="grid-3-col" style={{ marginBottom: '20px' }}>
          <div className="dash-card" style={{ gridColumn: 'span 2' }}>
            <div className="card-top">
              <h3>Placement Trends ({new Date().getFullYear()})</h3>
              <select className="mini-select"><option>This Year</option></select>
            </div>
            <div style={{ display: 'flex', gap: '20px', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '20px' }}>
              <span style={{ color: '#3b82f6' }}>— Placed</span>
              <span style={{ color: '#10b981' }}>— Offers</span>
              <span style={{ color: '#a855f7' }}>— Applications</span>
            </div>
            
            <div style={{ height: `${cHeight}px`, width: '100%', position: 'relative' }}>
              <svg viewBox={`0 0 ${cWidth} ${cHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                {[0, 1, 2, 3, 4].map(i => <line key={i} x1="0" y1={cHeight * (i/4)} x2={cWidth} y2={cHeight * (i/4)} stroke="#1e293b" />)}
                <path d={makeSmoothPath('apps')} fill="none" stroke="#a855f7" strokeWidth="3" />
                <path d={makeSmoothPath('off')} fill="none" stroke="#10b981" strokeWidth="3" />
                <path d={makeSmoothPath('pl')} fill="none" stroke="#3b82f6" strokeWidth="3" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', color: '#64748b', fontSize: '0.7rem' }}>
                {trendData.map(d => <span key={d.m}>{d.m}</span>)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: '15px', marginTop: '20px' }}>
              <div><div className="stat-lbl">Total Applications</div><div className="stat-val">{totalAppsCount}</div></div>
              <div><div className="stat-lbl">Active Interviews</div><div className="stat-val">{pipeline.interview}</div></div>
              <div><div className="stat-lbl">Total Offers</div><div className="stat-val">{pipeline.offers}</div></div>
              <div><div className="stat-lbl">Total Placements</div><div className="stat-val">{stats.placed}</div></div>
            </div>
          </div>

          <div className="dash-card">
            <h3>Placements by Domain</h3>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
              <div style={{ width: '160px', height: '160px', position: 'relative' }}>
                <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  {domainData.map(slice => {
                    if (totalDomain === 0) return null;
                    const pct = slice.v / totalDomain; const dash = `${pct * circ} ${circ}`; const off = cumPct * circ * -1; cumPct += pct;
                    return <circle key={slice.n} r={40} cx="50" cy="50" fill="transparent" stroke={slice.c} strokeWidth="16" strokeDasharray={dash} strokeDashoffset={off} />
                  })}
                  {totalDomain === 0 && <circle r={40} cx="50" cy="50" fill="transparent" stroke="#1e293b" strokeWidth="16" />}
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>{totalDomain}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Total Charted</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {domainData.length === 0 ? <div style={{textAlign:'center', color:'#64748b', fontSize:'0.8rem'}}>No data available</div> : 
               domainData.map(d => (
                <div key={d.n} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}><span style={{ width: '8px', height: '8px', background: d.c }}></span>{d.n}</div>
                  <div style={{ color: '#64748b' }}>{((d.v/totalDomain)*100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-3-col" style={{ marginBottom: '20px' }}>
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
                    <td style={{textAlign:'right'}}><span className="status-badge green">{(p.status||'Placed').toUpperCase()}</span></td>
                  </tr>
                )) : <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>No records found</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="dash-card">
            <div className="card-top">
              <h3>Global Calendar</h3>
              <button className="text-link" onClick={()=>navigate('/events')}>View All</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>
              <span>&lt;</span><span>{today.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><span>&gt;</span>
            </div>
            {renderCalendar()}
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {upcomingEvents.length === 0 ? <div style={{ fontSize:'0.8rem', color:'#64748b' }}>No upcoming schedule.</div> : 
               upcomingEvents.map((evt, i) => (
                <div key={i} style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ fontSize:'0.75rem', fontWeight:'bold', color:'#cbd5e1' }}>{evt.date.substring(0,6)}</div>
                  <div><div style={{fontSize:'0.8rem', color:'#fff', fontWeight:'bold'}}>{evt.title}</div><div style={{fontSize:'0.65rem', color:'#64748b'}}>{evt.type} - {evt.location||'Online'}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-2-col" style={{ marginBottom: '30px' }}>
          <div className="dash-card">
            <h3>Quick Access</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '15px' }}>
              <div className="qa-box" onClick={()=>navigate('/placement-drives')}><div className="qa-icon blue"><CalendarCheck weight="fill"/></div>Add Drive</div>
              <div className="qa-box" onClick={()=>navigate('/students')}><div className="qa-icon blue"><Users weight="fill"/></div>Add Student</div>
              {showReports && <div className="qa-box" onClick={()=>navigate('/tracker')}><div className="qa-icon green"><ListChecks weight="fill"/></div>Tracker</div>}
              <div className="qa-box" onClick={()=>navigate('/exams')}><div className="qa-icon orange"><NotePencil weight="fill"/></div>Exams</div>
              <div className="qa-box" onClick={()=>navigate('/study-materials')}><div className="qa-icon pink"><BookOpen weight="fill"/></div>Material</div>
              {showReports && <div className="qa-box" onClick={()=>navigate('/reports')}><div className="qa-icon teal"><ChartBar weight="fill"/></div>Gen. Report</div>}
              {showReports && <div className="qa-box" onClick={()=>navigate('/reports')}><div className="qa-icon purple"><Desktop weight="fill"/></div>View Reports</div>}
              <div className="qa-box" onClick={()=>navigate('/clients')}><div className="qa-icon orange"><FolderOpen weight="fill"/></div>Documents</div>
            </div>
          </div>

          <div className="dash-card">
            <div className="card-top">
              <h3>Live Application Pipeline</h3>
              <button className="text-link" onClick={()=>navigate('/applications')}>View Apps →</button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', textAlign: 'center' }}>
              <div><div style={{ fontSize: '0.7rem', color: '#f59e0b', marginBottom: '5px' }}>● Applied</div><div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>{pipeline.applied}</div></div>
              <div style={{ color: '#334155' }}>→</div>
              <div><div style={{ fontSize: '0.7rem', color: '#3b82f6', marginBottom: '5px' }}>● Interview</div><div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>{pipeline.interview}</div></div>
              <div style={{ color: '#334155' }}>→</div>
              <div><div style={{ fontSize: '0.7rem', color: '#a855f7', marginBottom: '5px' }}>● Offers</div><div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>{pipeline.offers}</div></div>
              <div style={{ color: '#334155' }}>→</div>
              <div><div style={{ fontSize: '0.7rem', color: '#10b981', marginBottom: '5px' }}>● Placed</div><div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>{pipeline.placed}</div></div>
            </div>

            <div style={{ marginTop: '25px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px dashed #1e293b' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#cbd5e1' }}>Pipeline Conversion Metrics</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '0.75rem' }}>
                <div style={{ background: '#0f1523', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>App ➔ Interview</span> 
                  <strong style={{ color: '#3b82f6', fontSize: '1rem' }}>{pipeline.applied ? ((pipeline.interview/pipeline.applied)*100).toFixed(1) : 0}%</strong>
                </div>
                <div style={{ background: '#0f1523', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Interview ➔ Offer</span> 
                  <strong style={{ color: '#a855f7', fontSize: '1rem' }}>{pipeline.interview ? ((pipeline.offers/pipeline.interview)*100).toFixed(1) : 0}%</strong>
                </div>
                <div style={{ background: '#0f1523', padding: '10px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Offer ➔ Joined</span> 
                  <strong style={{ color: '#10b981', fontSize: '1rem' }}>{pipeline.offers ? ((pipeline.placed/pipeline.offers)*100).toFixed(1) : 0}%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: '#fff' }}>Access Important Modules</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '40px' }}>
          <div onClick={() => navigate('/students')} className="module-card blue">
            <h4 style={{ color: '#3b82f6' }}>Student Directory</h4><p>View and manage student information</p><div className="link">View Students <ArrowRight size={14} weight="bold"/></div>
          </div>
          {isSuperAdmin && (
            <div onClick={() => navigate('/courses')} className="module-card green">
              <h4 style={{ color: '#10b981' }}>Course Management</h4><p>Create and manage courses & syllabus</p><div className="link">Manage Courses <ArrowRight size={14} weight="bold"/></div>
            </div>
          )}
          {(isSuperAdmin || userRole.includes('RTH')) && (
            <div onClick={() => navigate('/exams')} className="module-card purple">
              <h4 style={{ color: '#a855f7' }}>Assessment Center</h4><p>Create tests and evaluate students</p><div className="link">Go to Assessments <ArrowRight size={14} weight="bold"/></div>
            </div>
          )}
          <div onClick={() => navigate('/talentino')} className="module-card yellow">
            <h4 style={{ color: '#f59e0b' }}>Attendance Tracking</h4><p>Monitor daily Talentino check-ins</p><div className="link">View Attendance <ArrowRight size={14} weight="bold"/></div>
          </div>
          <div onClick={() => navigate('/placement-drives')} className="module-card pink">
            <h4 style={{ color: '#ec4899' }}>Placement Management</h4><p>Manage drives, offers and placements</p><div className="link">Manage Placements <ArrowRight size={14} weight="bold"/></div>
          </div>
          {showReports && (
            <div onClick={() => navigate('/reports')} className="module-card teal">
              <h4 style={{ color: '#0ea5e9' }}>Reports & Analytics</h4><p>Detailed insights and performance reports</p><div className="link">View Reports <ArrowRight size={14} weight="bold"/></div>
            </div>
          )}
          <div onClick={() => navigate('/clients')} className="module-card orange">
            <h4 style={{ color: '#f97316' }}>Document Center</h4><p>Store and manage important MOUs</p><div className="link">View Documents <ArrowRight size={14} weight="bold"/></div>
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

          .module-card { background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; cursor: pointer; transition: 0.2s; }
          .module-card:hover { transform: translateY(-4px); }
          .module-card h4 { margin: 0 0 8px 0; font-size: 1.05rem; }
          .module-card p { margin: 0 0 15px 0; font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; flex: 1; }
          .module-card .link { font-size: 0.8rem; font-weight: bold; display: flex; align-items: center; gap: 5px; margin-top: auto; }
          
          .module-card.blue { background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2); }
          .module-card.blue .link { color: #3b82f6; }
          .module-card.green { background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2); }
          .module-card.green .link { color: #10b981; }
          .module-card.purple { background: rgba(168, 85, 247, 0.05); border-color: rgba(168, 85, 247, 0.2); }
          .module-card.purple .link { color: #a855f7; }
          .module-card.yellow { background: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.2); }
          .module-card.yellow .link { color: #f59e0b; }
          .module-card.pink { background: rgba(236, 72, 153, 0.05); border-color: rgba(236, 72, 153, 0.2); }
          .module-card.pink .link { color: #ec4899; }
          .module-card.teal { background: rgba(14, 165, 233, 0.05); border-color: rgba(14, 165, 233, 0.2); }
          .module-card.teal .link { color: #0ea5e9; }
          .module-card.orange { background: rgba(249, 115, 22, 0.05); border-color: rgba(249, 115, 22, 0.2); }
          .module-card.orange .link { color: #f97316; }
        `}</style>
      </div>
    </Layout>
  );
}