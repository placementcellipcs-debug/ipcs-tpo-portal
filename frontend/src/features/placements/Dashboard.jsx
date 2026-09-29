import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Trophy, CalendarCheck, CircleNotch, 
  BookOpen, NotePencil, FolderOpen, ListChecks, Buildings,
  ChartBar, CheckCircle, CaretLeft, CaretRight
} from '@phosphor-icons/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';

function DashboardTooltip({ active, payload, label, selectedYear }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 1000 }}>
      {label && <p style={{ margin: '0 0 8px 0', borderBottom: '1px solid #334155', paddingBottom: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>{label} {selectedYear}</p>}
      {payload.map((entry, index) => (
        <div key={`${entry.name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.8rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }} />
          <span style={{ color: '#cbd5e1' }}>{entry.name}:</span>
          <span style={{ fontWeight: 'bold' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  
  // ---------------------------------------------------------
  // 🔐 ROLE-BASED ACCESS CONTROL
  // ---------------------------------------------------------
  let tpoData = {};
  try {
    const rawData = localStorage.getItem('tpoData');
    if (rawData) tpoData = JSON.parse(rawData) || {};
  } catch { console.error("Error reading tpoData"); }
  
  const userRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  const isSuperAdmin = accessType === 'superadmin' || userRole.includes('ADMIN') || userRole.includes('HEAD') || userRole.includes('MANAGER');
  const showReports = isSuperAdmin || userRole === 'TPO';
  const isTpo = userRole.includes('TPO') || isSuperAdmin; 
  const isPlacementOfficer = userRole.includes('TPO') || userRole.includes('PLACEMENT OFFICER');
  const canViewHiringPartners = !userRole.includes('TRAINER') && !userRole.includes('TECHNICAL LEAD') && !userRole.includes('REGIONAL TECHNICAL HEAD') && !userRole.includes('RTH') && !userRole.includes('TTH');
  const [stats, setStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0, totalCompanies: 0 });
  const [events, setEvents] = useState([]);
  const [recentPlacements, setRecentPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [greetingTime, setGreetingTime] = useState(() => new Date());
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Charting Data
  const [trendData, setTrendData] = useState(Array(12).fill({ m: '', Applications: 0, Placed: 0 }));
  const [domainData, setDomainData] = useState([]);
  const [allPlaced, setAllPlaced] = useState([]);
  
  // Dynamic Year Filter
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Raw Data Storage for Re-Filtering
  const [rawChartData, setRawChartData] = useState({ students: [], logs: [] });

  const [calendarDate, setCalendarDate] = useState(new Date());

  const DOMAIN_COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#0ea5e9'];

  useEffect(() => {
    const timer = setInterval(() => setGreetingTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const greeting = greetingTime.getHours() < 12 ? 'Good Morning' : greetingTime.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = String(tpoData?.name || '').trim().split(/\s+/)[0] || 'there';
  const dashboardFocus = userRole.includes('TRAINER')
    ? 'your training activity, assessments, and student progress.'
    : isPlacementOfficer
      ? 'your placement activity, employer updates, and upcoming drives.'
      : 'placement progress, upcoming events, and student resources.';
  const profilePhoto = (() => {
    const raw = String(tpoData?.photo || '');
    const match = raw.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : raw;
  })();

  // 🚨 FIXED DATE PARSER: Now handles MM/DD/YYYY directly from Google Sheets
  const parseDateRobust = (dStr) => {
    if (!dStr) return null;
    
    // 1. Try native parsing first (works flawlessly for MM/DD/YYYY)
    let parsedDate = new Date(dStr);
    
    // 2. If it fails, fallback to cleaning the string for DD/MM/YYYY formats
    if (isNaN(parsedDate.getTime())) {
      let cleanStr = typeof dStr === 'string' ? dStr.split(' ')[0].replace(/st|nd|rd|th|,/g, '') : dStr;
      if (typeof cleanStr === 'string' && (cleanStr.includes('/') || cleanStr.includes('-'))) {
        const parts = cleanStr.split(/[/-]/);
        if (parts.length === 3) {
           parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        }
      }
    }
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
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

  // 🚨 SMART CHART PROCESSOR
  const processChartData = (students, tpoLogs, targetYear) => {
    const yearsSet = new Set();
    
    // Scan all dates to populate the Dropdown with Real Years
    (tpoLogs || []).forEach(log => {
      const d = parseDateRobust(log.dateplaced || log.timestamp || log['Date Placed'] || log['TimeStamp']);
      if (d && d.getFullYear() > 2000) yearsSet.add(d.getFullYear());
    });
    (students || []).forEach(stu => {
      const d = parseDateRobust(stu.timestamp || stu.date || stu['TimeStamp']);
      if (d && d.getFullYear() > 2000) yearsSet.add(d.getFullYear());
    });

    const sortedYears = Array.from(yearsSet).sort((a,b) => b - a);
    if (sortedYears.length > 0 && availableYears.length === 1 && availableYears[0] === new Date().getFullYear()) {
       setAvailableYears(sortedYears);
    }
    
    // Auto-select most recent year if not selected
    const currentYear = targetYear || sortedYears[0] || new Date().getFullYear();
    if (!targetYear && sortedYears[0]) setSelectedYear(sortedYears[0]);
    
    // 1. Process Applications (From DATA Subsheet)
    const appsByMonth = Array(12).fill(0);
    (students || []).forEach(stu => {
      const d = parseDateRobust(stu.timestamp || stu.date || stu['TimeStamp'] || stu.joiningdate);
      if (d && d.getFullYear() === currentYear) {
        appsByMonth[d.getMonth()]++;
      }
    });

    // 2. Process Placements (From TPO_Log) with STRICT Deduplication
    const dedupedPlaced = {};
    const placedByMonth = Array(12).fill(0);
    const placedRecent = [];
    let domCount = {};

    (tpoLogs || []).forEach(log => {
      const getVal = (s) => { const key = Object.keys(log).find(k => k.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, ''))); return key ? log[key] : ''; };

      const roll = (getVal('rollnumber') || getVal('roll') || '').trim();
      const name = (getVal('studentname') || getVal('name') || '').trim();
      const company = (getVal('companyname') || getVal('company') || '').trim();
      const status = (getVal('status') || '').toLowerCase();
      const joining = (getVal('joiningstatus') || '').toLowerCase();

      // 🚨 CRITICAL FIX: Ignore 1000+ blank rows from Google Sheets returning empty data
      if (!name && !roll && !company) return;

      // 🚨 CRITICAL FIX: Only count explicitly placed/joined (Removed Offers)
      if (status.includes('placed') || joining.includes('join')) {
         const key = `${roll}_${company}_${name}`.toLowerCase();
         const d = parseDateRobust(getVal('dateplaced') || getVal('timestamp'));

         if (!dedupedPlaced[key] || (parseDateRobust(dedupedPlaced[key].date) < d)) {
           dedupedPlaced[key] = {
             name: name,
             company: company,
             course: getVal('course'),
             packageLpa: getVal('package'),
             status: getVal('status') || 'Placed',
             date: d
           };
         }
      }
    });

    Object.values(dedupedPlaced).forEach(p => {
      let c = getStandardDomain(p.course);
      domCount[c] = (domCount[c] || 0) + 1;

      if (p.date && p.date.getFullYear() === currentYear) {
        placedByMonth[p.date.getMonth()]++;
      }
      placedRecent.push(p);
    });

    // Output mapped Arrays
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const newTrend = months.map((m, i) => ({
      m,
      Applications: appsByMonth[i],
      Placed: placedByMonth[i]
    }));

    setTrendData(newTrend);
    setDomainData(Object.keys(domCount).map(k => ({ name: k, value: domCount[k] })).sort((a,b) => b.value - a.value).slice(0, 5));

    setAllPlaced(placedRecent);
    // 🚨 EXPANDED RECENT PLACEMENTS: Now slicing to 10 rows
    setRecentPlacements(placedRecent.sort((a, b) => (b.date?.getTime()||0) - (a.date?.getTime()||0)).slice(0, 10));
  };

  // Re-run chart processing if year changes
  useEffect(() => {
    if (rawChartData.students.length > 0 || rawChartData.logs.length > 0) {
      processChartData(rawChartData.students, rawChartData.logs, selectedYear);
    }
  }, [selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps -- The fetch below processes newly loaded chart data directly.

  // Rotate placements randomly to keep UI fresh
  useEffect(() => {
    if (allPlaced.length === 0) return;
    const interval = setInterval(() => {
      const shuffled = [...allPlaced].sort(() => 0.5 - Math.random());
      setRecentPlacements(shuffled.slice(0, 10));
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
          isDashboard: true // Tells backend to use Global Bypass for Non-TPOs
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
          // 🚨 EXTRACTING STUDENTS (DATA SHEET) AND TPO_LOGS
          const students = reportsRes.data.students || [];
          const logs = reportsRes.data.tpoLogs || [];
          
          setRawChartData({ students, logs });
          processChartData(students, logs, selectedYear);
        }

      } catch (err) { console.error("Dashboard Fetch Error:", err); } finally { setLoading(false); }
    };
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Dashboard data is loaded once for the current signed-in account.

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
        
        {/* WELCOME CARD */}
        <section className="dash-welcome-card">
          <div className="dash-welcome-copy">
            <span className="dash-welcome-date">{greetingTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</span>
            <h1>{greeting}, <em>{firstName}</em></h1>
            <p>Here’s an overview of {dashboardFocus}</p>
            <div className="dash-welcome-actions">
              <button type="button" onClick={() => navigate('/events')}>Explore events <span aria-hidden="true">→</span></button>
              <button type="button" className="dash-profile-link" onClick={() => navigate('/settings')}>View profile</button>
            </div>
          </div>
          <div className="dash-welcome-avatar" role="img" aria-label={`${firstName}'s profile`}>
            {profilePhoto && !avatarFailed ? <img src={profilePhoto} alt="" onError={() => setAvatarFailed(true)} /> : <span>{firstName.charAt(0).toUpperCase()}</span>}
          </div>
        </section>

        {/* KPI CARDS */}
        <div className="kpi-grid">
          <div className="dash-card">
            <div className="kpi-header"><div className="icon-c blue"><Users weight="fill" size={20}/></div><div><div className="kpi-title">Total Students</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.totalStudents}</div></div></div>
            <div className="kpi-trend green">↑ Live Database</div>{makeSparkline('#3b82f6')}
          </div>
          <div className="dash-card" title="Company records in the Clients sheet">
            <div className="kpi-header"><div className="icon-c teal"><Buildings weight="fill" size={20}/></div><div><div className="kpi-title">Total Companies</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.totalCompanies}</div></div></div>
            <div className="kpi-trend green">↑ Active Network</div>{makeSparkline('#0ea5e9')}
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
                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/><stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorPl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="m" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DashboardTooltip selectedYear={selectedYear} />} />
                  <Area type="monotone" dataKey="Applications" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorApps)" activeDot={{ r: 5, fill: 'var(--accent-primary)', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="Placed" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPl)" activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dash-card">
            <h3>Placements by Domain</h3>
            <div style={{ width: '100%', height: '170px', position: 'relative', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<DashboardTooltip selectedYear={selectedYear} />} />
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
                  {/* 🚨 RECENT PLACEMENTS EXPANDED TO 10 ROWS */}
                  {recentPlacements.length > 0 ? recentPlacements.map((p, i) => (
                    <tr key={i} style={{ animation: 'fadeInReveal 0.5s ease' }}>
                      <td><div style={{display:'flex', alignItems:'center', gap:'8px'}}><div className="tiny-avatar">{String(p.name||'U').charAt(0).toUpperCase()}</div> <span style={{color:'#fff'}}>{p.name}</span></div></td>
                      <td><span style={{color:'var(--accent-primary)', fontWeight:'bold'}}>{p.company}</span></td>
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

            <div className="dark-task-header" style={{ marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '15px' }}>
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

        {/* QUICK ACCESS & MODULES */}
        <div className="dash-card" style={{ marginBottom: '40px' }}>
          <h3 style={{ marginBottom: '15px' }}>Quick Actions & Modules</h3>
          <div className="qa-grid" aria-label="Quick actions">
            <button type="button" className="qa-box" onClick={() => navigate('/students')}><span className="qa-icon blue"><Users weight="fill" /></span><span>Student Directory</span></button>
            <button type="button" className="qa-box" onClick={() => navigate('/vacancies')}><span className="qa-icon orange"><Briefcase weight="fill" /></span><span>Open Vacancies</span></button>
            <button type="button" className="qa-box" onClick={() => navigate('/events')}><span className="qa-icon pink"><CalendarCheck weight="fill" /></span><span>Upcoming Events</span></button>
            <button type="button" className="qa-box" onClick={() => navigate('/exams')}><span className="qa-icon purple"><NotePencil weight="fill" /></span><span>Exam Centre</span></button>
            <button type="button" className="qa-box" onClick={() => navigate('/study-materials')}><span className="qa-icon teal"><BookOpen weight="fill" /></span><span>Study Materials</span></button>
            {canViewHiringPartners && <button type="button" className="qa-box" onClick={() => navigate('/clients')}><span className="qa-icon green"><FolderOpen weight="fill" /></span><span>Hiring Partners</span></button>}
            {isTpo && <button type="button" className="qa-box" onClick={() => navigate(isPlacementOfficer && !isSuperAdmin ? '/tracker?tab=drives' : '/placement-drives')}><span className="qa-icon purple"><CalendarCheck weight="fill" /></span><span>Placement Drives</span></button>}
            {isTpo && <button type="button" className="qa-box" onClick={() => navigate('/tracker')}><span className="qa-icon green"><ListChecks weight="fill" /></span><span>Placement Tracker</span></button>}
            {isTpo && <button type="button" className="qa-box" onClick={() => navigate('/talentino')}><span className="qa-icon yellow"><Users weight="fill" /></span><span>Talentino</span></button>}
            {showReports && <button type="button" className="qa-box" onClick={() => navigate('/reports')}><span className="qa-icon blue"><ChartBar weight="fill" /></span><span>Reports</span></button>}
          </div>
        </div>

        <style>{`
          .db-wrapper { font-family: 'Inter', sans-serif; }
          .dash-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; animation: dashboard-card-in .4s ease both; }
          .dash-card:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--accent-primary) 45%, var(--card-border)); box-shadow: 0 16px 28px rgba(0,0,0,.15); }
          .dash-card h3 { margin: 0; font-size: 1rem; color: var(--text-main); }
          @keyframes dashboard-card-in { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
          
          /* Core Grids */
          .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px; }
          .grid-3-col { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .grid-2-col { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; margin-bottom: 30px; }
          .qa-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 10px; }
          .modules-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 40px; }
          .span-2-col { grid-column: span 2; }
          
          .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px; }
          .dash-title { font-size: 2rem; margin: 0 0 5px 0; color: #fff; }
          .dash-subtitle { color: var(--text-muted); margin: 0; }
          .date-badge { background: var(--card-bg); border: 1px solid var(--card-border); padding: 10px 20px; border-radius: 30px; color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; gap: 10px; }

          .dash-welcome-card { display: flex; justify-content: space-between; align-items: center; gap: 28px; min-height: 250px; margin-bottom: 24px; padding: clamp(28px, 4vw, 48px); color: #f8fafc; background: radial-gradient(ellipse at 78% 12%, rgba(16,185,129,.2), transparent 43%), linear-gradient(112deg, #101b2b 0%, #102d31 100%); border: 1px solid rgba(45,212,191,.26); border-radius: 26px; box-shadow: 0 22px 55px rgba(2,8,23,.2); }
          .dash-welcome-copy { min-width: 0; max-width: 760px; }
          .dash-welcome-date { display: block; color: #34d399; font-size: .76rem; font-weight: 800; letter-spacing: .12em; margin-bottom: 13px; }
          .dash-welcome-copy h1 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -.045em; line-height: 1.08; color: #f8fafc; }
          .dash-welcome-copy h1 em { color: #34d399; font-style: normal; }
          .dash-welcome-copy p { max-width: 590px; margin: 12px 0 20px; color: #b5c9d8; font-size: 1rem; line-height: 1.6; }
          .dash-welcome-actions { display: flex; align-items: center; gap: 15px; flex-wrap: wrap; }
          .dash-welcome-actions button { display: inline-flex; align-items: center; gap: 12px; border: 0; border-radius: 11px; padding: 13px 20px; background: #059669; color: #fff; font: inherit; font-weight: 750; cursor: pointer; transition: transform .18s, background .18s; }
          .dash-welcome-actions button:hover { background: #10b981; transform: translateY(-1px); }
          .dash-welcome-actions .dash-profile-link { padding: 12px 3px; background: transparent; color: #f8fafc; }
          .dash-welcome-actions .dash-profile-link:hover { background: transparent; color: #6ee7b7; }
          .dash-welcome-avatar { width: 118px; height: 118px; flex: 0 0 118px; display: grid; place-items: center; overflow: hidden; border: 3px solid #34d399; border-radius: 50%; background: rgba(255,255,255,.08); color: #d1fae5; font-size: 2.8rem; font-weight: 750; box-shadow: 0 0 0 8px rgba(52,211,153,.08); }
          .dash-welcome-avatar img { width: 100%; height: 100%; object-fit: cover; }

          /* KPI Styling */
          .kpi-header { display: flex; align-items: center; gap: 15px; }
          .icon-c { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .icon-c.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
          .icon-c.green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
          .icon-c.purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
          .icon-c.orange { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
          .icon-c.pink { background: rgba(236, 72, 153, 0.1); color: #ec4899; }
          .icon-c.teal { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; }
          .kpi-title { font-size: 0.75rem; color: #8b949e; margin-bottom: 2px; text-transform: uppercase; font-weight: bold; }
          .kpi-val { font-size: 1.5rem; font-weight: bold; color: var(--text-main); }
          .kpi-trend { font-size: 0.7rem; margin-top: 10px; font-weight: bold; }
          .kpi-trend.green { color: #10b981; }

          .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
          .mini-select { background: #1e1e2f; color: #cbd5e1; border: 1px solid #334155; border-radius: 6px; padding: 4px 8px; font-size: 0.85rem; outline: none; }
          
          /* Area Chart Stats Row */
          .pipeline-stats-row { padding-top: 15px; margin-top: 15px; gap: 15px; border-top: 1px solid #1e1e2f; }
          .stat-lbl { font-size: 0.75rem; color: #8b949e; margin-bottom: 4px; text-transform: uppercase; font-weight: bold;}
          .stat-val { font-size: 1.4rem; font-weight: bold; }

          /* Donut Chart Center Text */
          .donut-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
          .donut-val { font-size: 1.5rem; font-weight: bold; color: #fff; }
          .donut-lbl { font-size: 0.65rem; color: var(--text-muted); }

          /* Responsive Table Wrapper */
          .table-responsive-wrapper { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .mini-table { width: 100%; min-width: 500px; border-collapse: collapse; }
          .mini-table th { border-bottom: 1px solid #1e1e2f; color: #8b949e; font-size: 0.75rem; padding-bottom: 10px; font-weight: normal; text-align: left; white-space: nowrap; }
          .mini-table td { padding: 12px 0; border-bottom: 1px solid #1e1e2f; font-size: 0.85rem; color: #cbd5e1; white-space: nowrap; }
          
          .tiny-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--accent-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; flex-shrink: 0; }
          .status-badge.green { background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; }
          .text-link { background: transparent; border: none; color: var(--accent-primary); font-size: 0.8rem; cursor: pointer; font-weight: bold; }
          .text-link:hover { text-decoration: underline; }

          /* Quick Access Boxes */
          .qa-box { min-height: 94px; background: var(--bg-dark); border-radius: 14px; border: 1px solid var(--card-border); padding: 14px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; cursor: pointer; font: inherit; font-size: 0.75rem; color: var(--text-main); font-weight: 750; text-align: center; transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease, background-color .2s ease;}
          .qa-icon { width: 38px; height: 38px; border-radius: 11px; border: 1px solid var(--card-border); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; background: var(--card-bg); transition: transform .2s ease, border-color .2s ease, background-color .2s ease; }
          .qa-box:hover { border-color: var(--accent-primary); background: color-mix(in srgb, var(--accent-primary) 7%, var(--bg-dark)); transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,.14); }
          .qa-box:hover .qa-icon { transform: translateY(-2px) scale(1.04); }
          .qa-box:hover .qa-icon { border-color: var(--accent-primary); }
          .qa-icon.blue { color: #3b82f6; } .qa-icon.green { color: #10b981; } .qa-icon.orange { color: #f59e0b; } .qa-icon.pink { color: #ec4899; } .qa-icon.teal { color: #0ea5e9; } .qa-icon.purple { color: #a855f7; } .qa-icon.yellow { color: #eab308; }

          /* Calendar & Schedule */
          .dark-task-list { background: #09090e; border: 1px solid #1e1e2f; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); }
          .dark-task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #1e1e2f; }
          .dark-task-header h3 { margin: 0; font-size: 1rem; color: #fff; }
          .task-count { font-size: 1.2rem; color: #fff; font-weight: bold; }
          
          .calendar-widget { background: #12121f; border-radius: 12px; padding: 15px; border: 1px solid #1e1e2f; }
          .cal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; color: #fff; font-weight: bold; font-size: 0.9rem; }
          .cal-header button { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #8b949e; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 6px; }
          .cal-header button:hover { background: rgba(255,255,255,0.1); color: #fff; border-color: var(--accent-primary); }
          .cal-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; }
          .cal-day-name { font-size: 0.7rem; color: #8b949e; font-weight: bold; margin-bottom: 5px; }
          .cal-day { position: relative; font-size: 0.85rem; color: #cbd5e1; padding: 8px 0; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-direction: column; transition: 0.2s; }
          .cal-day.blank { background: transparent; }
          .cal-day:not(.blank):hover { background: rgba(255,255,255,0.05); cursor: pointer; color: #fff; }
          .cal-day.today { background: color-mix(in srgb, var(--accent-primary) 15%, transparent); color: var(--accent-primary); font-weight: bold; border: 1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent); }
          .cal-day.has-event { color: #fff; font-weight: bold; }
          .event-dot { width: 4px; height: 4px; background: #f59e0b; border-radius: 50%; margin-top: 2px; }

          .dark-tasks { display: flex; flex-direction: column; gap: 15px; }
          .dark-task-item { display: flex; align-items: flex-start; gap: 15px; }
          .dt-icon { width: 32px; height: 32px; border-radius: 10px; background: rgba(255,255,255,0.05); color: #8b949e; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .dt-info { flex: 1; min-width: 0; }
          .dt-info h4 { margin: 0 0 4px 0; font-size: 0.85rem; color: #e2e8f0; font-weight: 600; white-space: normal; line-height: 1.3; }
          .dt-info p { margin: 0; font-size: 0.7rem; color: #8b949e; display: flex; align-items: center; gap: 4px; }
          .dt-check { color: #10b981; flex-shrink: 0; }
          .empty-tasks { color: #8b949e; font-size: 0.85rem; font-style: italic; }

          /* ==============================================
             📱 RESPONSIVE BREAKPOINTS (FLUID CALIBRATION)
          ============================================== */
          
          /* 💻 TABLET / SMALL LAPTOP */
          @media (max-width: 1100px) {
            .grid-3-col { grid-template-columns: 1fr 1fr; }
            .span-2-col { grid-column: span 2; }
            .grid-2-col { grid-template-columns: 1fr; }
          }
          
          /* 📱 MOBILE */
          @media (max-width: 768px) {
            .dashboard-header { flex-direction: column; align-items: flex-start; gap: 10px; }
            .dash-title { font-size: 1.5rem; }
            .dash-welcome-card { min-height: 0; align-items: flex-start; padding: 26px 22px; border-radius: 20px; }
            .dash-welcome-avatar { width: 70px; height: 70px; flex-basis: 70px; font-size: 1.8rem; }
            
            .kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .kpi-header { gap: 10px; }
            .icon-c { width: 35px; height: 35px; }
            .kpi-val { font-size: 1.2rem; }
            
            .grid-3-col, .grid-2-col { grid-template-columns: 1fr; gap: 15px; }
            .span-2-col { grid-column: span 1; }
          }
          
          /* 📱 TINY MOBILE */
          @media (max-width: 480px) {
            .dash-welcome-card { gap: 14px; }
            .dash-welcome-avatar { width: 50px; height: 50px; flex-basis: 50px; border-width: 2px; font-size: 1.35rem; }
            .dash-welcome-copy h1 { font-size: 1.75rem; }
            .dash-welcome-copy p { font-size: .9rem; margin: 10px 0 16px; }
            .dash-welcome-actions { gap: 10px; }
            .dash-welcome-actions button { padding: 11px 13px; font-size: .9rem; }
            .kpi-grid { grid-template-columns: 1fr; }
          }

          /* 📺 4K TV / LARGE DISPLAYS */
          @media (min-width: 1800px) {
            .kpi-grid { grid-template-columns: repeat(6, 1fr); }
            .qa-grid { grid-template-columns: repeat(8, 1fr); }
            .modules-grid { grid-template-columns: repeat(4, 1fr); }
          }
        `}</style>
      </div>
    </Layout>
  );
}
