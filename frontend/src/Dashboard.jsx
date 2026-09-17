import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Trophy, CalendarCheck, CircleNotch, 
  BookOpen, NotePencil, FolderOpen, ListChecks, Buildings,
  ChartBar, Clock, CheckCircle, ArrowRight, CaretLeft, CaretRight
} from '@phosphor-icons/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function Dashboard() {
  const navigate = useNavigate();
  
  // ---------------------------------------------------------
  // 🔐 ROLE-BASED ACCESS CONTROL
  // ---------------------------------------------------------
  let tpoData = {};
  try {
    const rawData = localStorage.getItem('tpoData');
    if (rawData) tpoData = JSON.parse(rawData) || {};
  } catch(e) { console.error("Error reading tpoData"); }
  
  const userRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  const isSuperAdmin = accessType === 'superadmin' || userRole.includes('ADMIN') || userRole.includes('HEAD') || userRole.includes('MANAGER');
  const showReports = isSuperAdmin || userRole === 'TPO';
  const isTpo = userRole.includes('TPO') || isSuperAdmin; 
  const isTrainer = userRole.includes('TRAINER') || userRole.includes('TTH') || isSuperAdmin;
  
  const [stats, setStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0, totalCompanies: 0 });
  const [events, setEvents] = useState([]);
  const [recentPlacements, setRecentPlacements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Charting Data
  const [trendData, setTrendData] = useState(Array(12).fill({ m: '', Applications: 0, Placed: 0 }));
  const [domainData, setDomainData] = useState([]);
  const [pipeline, setPipeline] = useState({ applied: 0, interview: 0, placed: 0 });
  const [totalAppsCount, setTotalAppsCount] = useState(0);
  const [allPlaced, setAllPlaced] = useState([]);
  
  // Dynamic Year Filter
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Raw Data Storage for Re-Filtering
  const [rawChartData, setRawChartData] = useState({ apps: [], logs: [] });

  const [trainerLogs, setTrainerLogs] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const DOMAIN_COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#0ea5e9'];

  const parseDateRobust = (dStr) => {
    if (!dStr) return null;
    let cleanStr = typeof dStr === 'string' ? dStr.split(' ')[0].replace(/st|nd|rd|th|,/g, '') : dStr;
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

  const getStandardDomain = (courseStr) => {
    if (!courseStr) return 'Other Domains';
    const c = String(courseStr).toLowerCase();
    if (c.includes('automation') || c.includes('plc') || c.includes('scada')) return 'Industrial Automation';
    if (c.includes('bms') || c.includes('cctv')) return 'BMS & CCTV';
    if (c.includes('embed') || c.includes('iot')) return 'Embedded & IoT';
    if (c.includes('digital') || c.includes('dm') || c.includes('marketing')) return 'Digital Marketing';
    if (c.includes('python') || c.includes('data') || c.includes('it') || c.includes('software')) return 'Data Science & IT';
    return 'Other Domains';
  };

  // 🚨 SMART CHART PROCESSOR (Handles True Years, Pure App Counts, Strict Placed Deduplication)
  const processChartData = (applications, tpoLogs, targetYear) => {
    const yearsSet = new Set();
    const currentYear = targetYear || new Date().getFullYear();
    
    // 1. Process Raw Applications (Data Subsheet -> OpeningApplied)
    let pApp = 0;
    const appsByMonth = Array(12).fill(0);
    
    applications.forEach(app => {
      const getVal = (s) => { const k = Object.keys(app).find(key => key.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, ''))); return k ? app[k] : ''; };
      
      const d = parseDateRobust(getVal('timestamp') || getVal('date'));
      if (d) {
        yearsSet.add(d.getFullYear());
        if (d.getFullYear() === currentYear) appsByMonth[d.getMonth()]++;
      }
      pApp++;
    });

    // 2. Process TPO Logs (Interviews & Strict Placed)
    const dedupedPlaced = {};
    const dedupedInterviews = {};
    
    tpoLogs.forEach(log => {
      const getVal = (s) => { const key = Object.keys(log).find(k => k.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, ''))); return key ? log[key] : ''; };
      
      const st = (getVal('status') || '').toLowerCase();
      const jSt = (getVal('joiningstatus') || '').toLowerCase();
      const roll = getVal('roll') || getVal('rollnumber');
      const company = getVal('company') || getVal('companyname');
      const key = `${roll}_${company}`;

      const isPlaced = st.includes('placed') || st.includes('got offer') || st.includes('offer') || jSt.includes('join');
      const isInterview = st.includes('interview') || st.includes('shortlist');

      const d = parseDateRobust(getVal('dateplaced') || getVal('timestamp'));
      if (d) yearsSet.add(d.getFullYear());

      // Only save the most recent placement record per student per company
      if (isPlaced && (!dedupedPlaced[key] || parseDateRobust(dedupedPlaced[key].date) < d)) {
        dedupedPlaced[key] = { name: getVal('studentname'), company, course: getVal('course'), packageLpa: getVal('package'), status: getVal('status'), date: d };
      }
      
      if (isInterview && !dedupedInterviews[key]) dedupedInterviews[key] = true;
    });

    // 3. Populate Placed Month & Domain Data
    const placedByMonth = Array(12).fill(0);
    let pPl = 0;
    const placedRecent = [];
    let domCount = {};

    Object.values(dedupedPlaced).forEach(p => {
      pPl++;
      let c = getStandardDomain(p.course);
      domCount[c] = (domCount[c] || 0) + 1;
      
      if (p.date && p.date.getFullYear() === currentYear) {
        placedByMonth[p.date.getMonth()]++;
      }
      placedRecent.push(p);
    });

    // Set States
    const sortedYears = Array.from(yearsSet).sort((a,b) => b - a);
    if (sortedYears.length > 0) setAvailableYears(sortedYears);

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const newTrend = months.map((m, i) => ({
      m,
      Applications: appsByMonth[i],
      Placed: placedByMonth[i]
    }));

    const formattedDomains = Object.keys(domCount).map(k => ({ name: k, value: domCount[k] })).sort((a,b) => b.value - a.value).slice(0, 5); 

    setTrendData(newTrend);
    setDomainData(formattedDomains);
    setPipeline({ applied: pApp, interview: Object.keys(dedupedInterviews).length, placed: pPl });
    setTotalAppsCount(pApp);
    
    // Set 9 Recent Placements
    setAllPlaced(placedRecent);
    const sortedRecent = placedRecent.sort((a, b) => (b.date?.getTime()||0) - (a.date?.getTime()||0)).slice(0, 9);
    setRecentPlacements(sortedRecent);
  };

  // Re-run chart processing if year changes
  useEffect(() => {
    if (rawChartData.apps.length > 0 || rawChartData.logs.length > 0) {
      processChartData(rawChartData.apps, rawChartData.logs, selectedYear);
    }
  }, [selectedYear]);

  // Rotate placements
  useEffect(() => {
    if (allPlaced.length === 0) return;
    const interval = setInterval(() => {
      const shuffled = [...allPlaced].sort(() => 0.5 - Math.random());
      setRecentPlacements(shuffled.slice(0, 9));
    }, 60000); 
    return () => clearInterval(interval);
  }, [allPlaced]);

  useEffect(() => {
    const localTpoStr = localStorage.getItem('tpoData');
    if (!localTpoStr) return;
    const localTpo = JSON.parse(localTpoStr);

    const fetchData = async () => {
      try {
        const reqPayload = { 
          assignedBranchesArray: localTpo.assignedBranchesArray || [], 
          role: localTpo.role || '', 
          assignedCourse: localTpo.assignedCourse || '', 
          tpoName: localTpo.name || '',
          isDashboard: true 
        };
        
        const [statsRes, reportsRes] = await Promise.all([
          axios.post(`${API_BASE}/api/tpo/dashboard-stats`, reqPayload),
          axios.post(`${API_BASE}/api/tpo/reports`, reqPayload)
        ]);
        
        if (statsRes.data && statsRes.data.success) {
          setStats(statsRes.data.stats || stats);
          setEvents(statsRes.data.events || []);
        }

        if (reportsRes.data && reportsRes.data.success) {
          const apps = reportsRes.data.applications || [];
          const logs = reportsRes.data.tpoLogs || [];
          setRawChartData({ apps, logs });
          processChartData(apps, logs, selectedYear);
        }

        if ((localTpo.role || '').toUpperCase().includes('TRAINER') || localTpo.accessType === 'superadmin') {
          try {
            const trRes = await axios.get(`${API_BASE}/api/admin/trainer-logs`);
            if (trRes.data && trRes.data.success) {
              let myLogs = trRes.data.logs || [];
              if (localTpo.accessType !== 'superadmin') {
                 myLogs = myLogs.filter(l => l.trainerName === localTpo.name);
              }
              setTrainerLogs(myLogs.slice(0, 5));
            }
          } catch (e) { console.error("Failed to load trainer logs"); }
        }

      } catch (err) { console.error("Dashboard Fetch Error:", err); } finally { setLoading(false); }
    };
    fetchData();
  }, []); 

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const upcomingEvents = (events || []).filter(e => {
    const pd = parseDateRobust(e?.date);
    return pd && pd >= today && !String(e?.title || '').toLowerCase().includes('dummy');
  }).sort((a,b) => (parseDateRobust(a.date)?.getTime()||0) - (parseDateRobust(b.date)?.getTime()||0)).slice(0, 4);
  
  const upDrivesCount = (events || []).filter(e => String(e?.type||'').toLowerCase().includes('drive') && parseDateRobust(e.date) >= today).length;

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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 1000 }}>
          {label && <p style={{ margin: '0 0 8px 0', borderBottom: '1px solid #334155', paddingBottom: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>{label} {selectedYear}</p>}
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.8rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }}></div>
              <span style={{ color: '#cbd5e1' }}>{entry.name}:</span>
              <span style={{ fontWeight: 'bold' }}>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({length: daysInMonth}, (_, i) => i + 1);

  const eventDates = new Set(events.map(e => {
    const d = parseDateRobust(e.date);
    return d ? d.toDateString() : null;
  }).filter(Boolean));

  return (
    <Layout>
      <div className="db-wrapper" style={{ paddingBottom: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* HEADER SECTION */}
        <div className="dashboard-header">
          <div>
            <h1 className="dash-title">Good Morning, {String(tpoData?.name || 'Officer').split(' ')[0]} 👋</h1>
            <p className="dash-subtitle">Here's what's happening across the network today.</p>
          </div>
          <div className="date-badge">
            <Clock size={16} /> {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="kpi-grid">
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
          
          {/* 🚨 NEW: TOTAL COMPANIES KPI */}
          <div className="dash-card">
            <div className="kpi-header"><div className="icon-c teal"><Buildings weight="fill" size={20}/></div><div><div className="kpi-title">Total Companies</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.totalCompanies}</div></div></div>
            <div className="kpi-trend green">↑ Active Network</div>{makeSparkline('#0ea5e9')}
          </div>
        </div>

        {/* MAIN CHARTS */}
        <div className="grid-3-col">
          
          <div className="dash-card span-2-col" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-top">
              <h3>Placement Trends</h3>
              {/* 🚨 DYNAMIC YEAR SELECTOR */}
              <select className="mini-select" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            
            <div style={{ flex: 1, width: '100%', minHeight: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorPl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="m" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Applications" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorApps)" activeDot={{ r: 5, fill: '#a855f7', strokeWidth: 0 }} />
                  {/* 🚨 REMOVED OFFERS LINE, ONLY SHOWS PLACED */}
                  <Area type="monotone" dataKey="Placed" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPl)" activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 🚨 UPDATED PIPELINE: APPLIED -> INTERVIEW -> PLACED */}
            <div className="pipeline-stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', display: 'grid', textAlign: 'center' }}>
              <div><div className="stat-lbl">Total Applications</div><div className="stat-val" style={{ color: '#3b82f6' }}>{pipeline.applied}</div></div>
              <div style={{ borderLeft: '1px solid #1e293b', borderRight: '1px solid #1e293b' }}><div className="stat-lbl">Interviews Scheduled</div><div className="stat-val" style={{ color: '#f59e0b' }}>{pipeline.interview}</div></div>
              <div><div className="stat-lbl">Total Placed</div><div className="stat-val" style={{ color: '#10b981' }}>{pipeline.placed}</div></div>
            </div>
          </div>

          <div className="dash-card">
            <h3>Placements by Domain</h3>
            <div style={{ width: '100%', height: '170px', position: 'relative', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie data={domainData.length > 0 ? domainData : [{name: 'No Data', value: 1}]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                    {(domainData.length > 0 ? domainData : [{name: 'No Data'}]).map((e, i) => <Cell key={`c-${i}`} fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} /> )}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <div className="donut-val">{stats.placed}</div>
                <div className="donut-lbl">Total</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
              {domainData.length === 0 ? <div style={{textAlign:'center', color:'#64748b', fontSize:'0.8rem'}}>No data available</div> : 
                domainData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: DOMAIN_COLORS[i % DOMAIN_COLORS.length] }}></span>{d.name}</div>
                  <div style={{ color: '#fff', fontWeight: 'bold' }}>{d.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RECENT PLACEMENTS & CALENDAR EVENTS GRID */}
        <div className="grid-3-col">
          
          <div className="dash-card span-2-col">
            <div className="card-top">
              <h3>Recent Placement Activity</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '12px' }}><CircleNotch size={12} className="ph-spin" /> Live</span>
                <button className="text-link" onClick={()=>navigate('/placed')}>View All</button>
              </div>
            </div>
            <div className="table-responsive-wrapper">
              <table className="mini-table">
                <thead>
                  <tr><th>Student</th><th>Company</th><th>Role</th><th style={{textAlign:'right'}}>Package</th><th style={{textAlign:'right'}}>Status</th></tr>
                </thead>
                <tbody>
                  {/* 🚨 NOW RENDER 9 ROWS */}
                  {recentPlacements.length > 0 ? recentPlacements.map((p, i) => (
                    <tr key={i} style={{ animation: 'fadeInReveal 0.5s ease' }}>
                      <td><div style={{display:'flex', alignItems:'center', gap:'8px'}}><div className="tiny-avatar">{String(p.name||'U').charAt(0).toUpperCase()}</div> <span style={{color:'#fff'}}>{p.name}</span></div></td>
                      <td><span style={{color:'#3b82f6', fontWeight:'bold'}}>{p.company}</span></td>
                      <td>{p.course}</td>
                      <td style={{textAlign:'right', fontWeight:'bold', color:'#fff'}}>
                        {p.packageLpa ? `${String(p.packageLpa).toUpperCase().replace('LPA', '').trim()} LPA` : '-'}
                      </td>
                      <td style={{textAlign:'right'}}><span className="status-badge green">{String(p.status||'Placed').toUpperCase()}</span></td>
                    </tr>
                  )) : <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>No records found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dash-card dark-task-list" style={{ padding: '20px' }}>
            <div className="dark-task-header">
              <h3>Event Calendar</h3>
            </div>
            
            <div className="calendar-widget">
              <div className="cal-header">
                <button onClick={prevMonth}><CaretLeft size={16} weight="bold"/></button>
                <span>{monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}</span>
                <button onClick={nextMonth}><CaretRight size={16} weight="bold"/></button>
              </div>
              <div className="cal-days">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="cal-day-name">{d}</div>)}
                {blanks.map((_, i) => <div key={`blank-${i}`} className="cal-day blank"></div>)}
                {days.map(day => {
                  const currentIterationDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                  const isToday = currentIterationDate.toDateString() === new Date().toDateString();
                  const hasEvent = eventDates.has(currentIterationDate.toDateString());
                  return (
                    <div key={day} className={`cal-day ${isToday ? 'today' : ''} ${hasEvent ? 'has-event' : ''}`}>
                      {day}
                      {hasEvent && <span className="event-dot"></span>}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="dark-task-header" style={{ marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '15px' }}>
              <h3>Upcoming Schedule</h3>
              <span className="task-count">{upcomingEvents.length}</span>
            </div>
            <div className="dark-tasks">
              {upcomingEvents.length === 0 ? <p className="empty-tasks">No events scheduled.</p> :
                upcomingEvents.map((evt, i) => (
                  <div key={i} className="dark-task-item">
                    <div className="dt-icon"><CalendarCheck size={18} weight="fill"/></div>
                    <div className="dt-info">
                      <h4>{evt.title}</h4>
                      <p>{String(evt.date || '').substring(0,10)} | {evt.location || 'Online'}</p>
                    </div>
                    <div className="dt-check"><CheckCircle size={20} weight="fill"/></div>
                  </div>
              ))}
            </div>
          </div>
        </div>

        {/* QUICK ACCESS & PIPELINE */}
        <div className="grid-2-col">
          
          <div className="dash-card">
            <h3>Quick Access</h3>
            <div className="qa-grid">
              <div className="qa-box" onClick={()=>navigate('/students')}><div className="qa-icon blue"><Users weight="fill"/></div>Students</div>
              <div className="qa-box" onClick={()=>navigate('/exams')}><div className="qa-icon orange"><NotePencil weight="fill"/></div>Exams</div>
              <div className="qa-box" onClick={()=>navigate('/study-materials')}><div className="qa-icon pink"><BookOpen weight="fill"/></div>Material</div>
              <div className="qa-box" onClick={()=>navigate('/clients')}><div className="qa-icon teal"><FolderOpen weight="fill"/></div>Documents</div>
              
              {isTpo && <div className="qa-box" onClick={()=>navigate('/placement-drives')}><div className="qa-icon purple"><CalendarCheck weight="fill"/></div>Drives</div>}
              {isTpo && <div className="qa-box" onClick={()=>navigate('/tracker')}><div className="qa-icon green"><ListChecks weight="fill"/></div>Tracker</div>}
              {isTpo && <div className="qa-box" onClick={()=>navigate('/talentino')}><div className="qa-icon yellow"><Users weight="fill"/></div>Talentino</div>}
              {showReports && <div className="qa-box" onClick={()=>navigate('/reports')}><div className="qa-icon blue"><ChartBar weight="fill"/></div>Reports</div>}
            </div>
          </div>

          {/* 🚨 PIPELINE: APPLIED -> INTERVIEW -> PLACED */}
          <div className="dash-card">
            <div className="card-top">
              <h3>Live Application Pipeline</h3>
              <button className="text-link" onClick={()=>navigate('/applications')}>View Apps →</button>
            </div>
            
            <div className="pipeline-visual">
              <div><div className="pl-dot blue">● Applied</div><div className="pl-val">{pipeline.applied}</div></div>
              <div className="pl-arrow">→</div>
              <div><div className="pl-dot orange">● Interview</div><div className="pl-val">{pipeline.interview}</div></div>
              <div className="pl-arrow">→</div>
              <div><div className="pl-dot green">● Placed</div><div className="pl-val">{pipeline.placed}</div></div>
            </div>

            <div className="pipeline-conversion">
              <div className="conv-box">
                <span className="conv-lbl">App ➔ Interview</span> 
                <strong className="conv-val blue">{pipeline.applied ? ((pipeline.interview/pipeline.applied)*100).toFixed(1) : 0}%</strong>
              </div>
              <div className="conv-box">
                <span className="conv-lbl">Interview ➔ Placed</span> 
                <strong className="conv-val green">{pipeline.interview ? ((pipeline.placed/pipeline.interview)*100).toFixed(1) : 0}%</strong>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM MODULE CARDS */}
        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: '#fff' }}>Access Important Modules</h3>
        
        <div className="modules-grid">
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
          
          /* Core Grids */
          .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px; }
          .grid-3-col { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .grid-2-col { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; margin-bottom: 30px; }
          .qa-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 15px; }
          .modules-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 40px; }
          .span-2-col { grid-column: span 2; }
          
          .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px; }
          .dash-title { font-size: 2rem; margin: 0 0 5px 0; color: #fff; }
          .dash-subtitle { color: var(--text-muted); margin: 0; }
          .date-badge { background: var(--card-bg); border: 1px solid var(--card-border); padding: 10px 20px; border-radius: 30px; color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; gap: 10px; }

          /* KPI Styling */
          .kpi-header { display: flex; align-items: center; gap: 15px; }
          .icon-c { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
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

          .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
          .mini-select { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; border-radius: 6px; padding: 4px 8px; font-size: 0.75rem; outline: none; }
          
          /* Area Chart Stats Row */
          .pipeline-stats-row { padding-top: 15px; margin-top: 15px; gap: 15px; }
          .stat-lbl { font-size: 0.75rem; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-weight: bold;}
          .stat-val { font-size: 1.4rem; font-weight: bold; }

          /* Donut Chart Center Text */
          .donut-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
          .donut-val { font-size: 1.5rem; font-weight: bold; color: #fff; }
          .donut-lbl { font-size: 0.65rem; color: var(--text-muted); }

          /* Responsive Table Wrapper */
          .table-responsive-wrapper { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .mini-table { width: 100%; min-width: 500px; border-collapse: collapse; }
          .mini-table th { border-bottom: 1px solid #1e293b; color: #64748b; font-size: 0.75rem; padding-bottom: 10px; font-weight: normal; text-align: left; white-space: nowrap; }
          .mini-table td { padding: 12px 0; border-bottom: 1px solid #1e293b; font-size: 0.85rem; color: #cbd5e1; white-space: nowrap; }
          
          .tiny-avatar { width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; flex-shrink: 0; }
          .status-badge.green { background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; }
          .text-link { background: transparent; border: none; color: #8b5cf6; font-size: 0.8rem; cursor: pointer; font-weight: bold; }
          .text-link:hover { text-decoration: underline; }

          /* Quick Access Boxes */
          .qa-box { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; font-size: 0.7rem; color: #cbd5e1; font-weight: bold; }
          .qa-icon { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #1e293b; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.2s; }
          .qa-box:hover .qa-icon { border-color: #8b5cf6; transform: translateY(-2px); }
          .qa-icon.blue { color: #3b82f6; } .qa-icon.green { color: #10b981; } .qa-icon.orange { color: #f59e0b; } .qa-icon.pink { color: #ec4899; } .qa-icon.teal { color: #0ea5e9; } .qa-icon.purple { color: #a855f7; } .qa-icon.yellow { color: #eab308; }

          /* Live Pipeline Section */
          .pipeline-visual { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; text-align: center; flex-wrap: wrap; gap: 10px; padding: 10px 20px;}
          .pl-dot { font-size: 0.7rem; margin-bottom: 5px; font-weight: bold; text-transform: uppercase; }
          .pl-dot.orange { color: #f59e0b; } .pl-dot.blue { color: #3b82f6; } .pl-dot.purple { color: #a855f7; } .pl-dot.green { color: #10b981; }
          .pl-val { font-size: 1.8rem; font-weight: bold; color: #fff; }
          .pl-arrow { color: #334155; display: flex; align-items: center; font-size: 1.5rem; }
          
          .pipeline-conversion { margin-top: 25px; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px dashed #1e293b; display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; }
          .conv-box { background: #0f1523; padding: 10px; border-radius: 8px; border: 1px solid #1e293b; text-align: center;}
          .conv-lbl { color: #94a3b8; display: block; margin-bottom: 4px; font-size: 0.75rem; text-transform: uppercase; font-weight: bold;}
          .conv-val { font-size: 1.1rem; } .conv-val.blue { color: #3b82f6; } .conv-val.purple { color: #a855f7; } .conv-val.green { color: #10b981; }

          /* Module Cards */
          .module-card { background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; cursor: pointer; transition: 0.2s; }
          .module-card:hover { transform: translateY(-4px); }
          .module-card h4 { margin: 0 0 8px 0; font-size: 1.05rem; }
          .module-card p { margin: 0 0 15px 0; font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; flex: 1; }
          .module-card .link { font-size: 0.8rem; font-weight: bold; display: flex; align-items: center; gap: 5px; margin-top: auto; }
          
          .module-card.blue { background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2); } .module-card.blue .link { color: #3b82f6; }
          .module-card.green { background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2); } .module-card.green .link { color: #10b981; }
          .module-card.purple { background: rgba(168, 85, 247, 0.05); border-color: rgba(168, 85, 247, 0.2); } .module-card.purple .link { color: #a855f7; }
          .module-card.yellow { background: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.2); } .module-card.yellow .link { color: #f59e0b; }
          .module-card.pink { background: rgba(236, 72, 153, 0.05); border-color: rgba(236, 72, 153, 0.2); } .module-card.pink .link { color: #ec4899; }
          .module-card.teal { background: rgba(14, 165, 233, 0.05); border-color: rgba(14, 165, 233, 0.2); } .module-card.teal .link { color: #0ea5e9; }
          .module-card.orange { background: rgba(249, 115, 22, 0.05); border-color: rgba(249, 115, 22, 0.2); } .module-card.orange .link { color: #f97316; }

          /* Calendar & Schedule */
          .dark-task-list { background: #1a1a1a; border: none; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); }
          .dark-task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #333; }
          .dark-task-header h3 { margin: 0; font-size: 1rem; color: #fff; }
          .task-count { font-size: 1.2rem; color: #fff; font-weight: bold; }
          
          .calendar-widget { background: #0f1523; border-radius: 12px; padding: 15px; border: 1px solid #1e293b; }
          .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; color: #fff; font-weight: bold; font-size: 0.9rem; }
          .cal-header button { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 6px; }
          .cal-header button:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: #8b5cf6; }
          .cal-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; }
          .cal-day-name { font-size: 0.7rem; color: #64748b; font-weight: bold; margin-bottom: 5px; }
          .cal-day { position: relative; font-size: 0.85rem; color: #cbd5e1; padding: 8px 0; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-direction: column; transition: 0.2s; }
          .cal-day.blank { background: transparent; }
          .cal-day:not(.blank):hover { background: rgba(255,255,255,0.05); cursor: pointer; color: #fff; }
          .cal-day.today { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; font-weight: bold; border: 1px solid rgba(139, 92, 246, 0.3); }
          .cal-day.has-event { color: #fff; font-weight: bold; }
          .event-dot { width: 4px; height: 4px; background: #f59e0b; border-radius: 50%; margin-top: 2px; }

          .dark-tasks { display: flex; flex-direction: column; gap: 15px; }
          .dark-task-item { display: flex; align-items: flex-start; gap: 15px; }
          .dt-icon { width: 32px; height: 32px; border-radius: 10px; background: rgba(255,255,255,0.05); color: #94a3b8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .dt-info { flex: 1; min-width: 0; }
          .dt-info h4 { margin: 0 0 4px 0; font-size: 0.85rem; color: #e2e8f0; font-weight: 600; white-space: normal; line-height: 1.3; }
          .dt-info p { margin: 0; font-size: 0.7rem; color: #64748b; display: flex; align-items: center; gap: 4px; }
          .dt-check { color: #10b981; flex-shrink: 0; }
          .empty-tasks { color: #64748b; font-size: 0.85rem; font-style: italic; }

          /* RESPONSIVE */
          @media (max-width: 1100px) {
            .grid-3-col { grid-template-columns: 1fr 1fr; }
            .span-2-col { grid-column: span 2; }
            .grid-2-col { grid-template-columns: 1fr; }
            .qa-grid { grid-template-columns: repeat(4, 1fr); }
          }
          
          @media (max-width: 768px) {
            .dashboard-header { flex-direction: column; align-items: flex-start; gap: 10px; }
            .dash-title { font-size: 1.5rem; }
            .kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .kpi-header { gap: 10px; }
            .icon-c { width: 35px; height: 35px; }
            .kpi-val { font-size: 1.2rem; }
            .grid-3-col, .grid-2-col { grid-template-columns: 1fr; gap: 15px; }
            .span-2-col { grid-column: span 1; }
            .qa-grid { grid-template-columns: repeat(2, 1fr); }
            .pipeline-visual { flex-direction: column; gap: 15px; align-items: flex-start; }
            .pl-arrow { display: none; }
            .modules-grid { grid-template-columns: 1fr; gap: 10px; }
          }
        `}</style>
      </div>
    </Layout>
  );
}