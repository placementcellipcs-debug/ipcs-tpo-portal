import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Trophy, CalendarCheck, CircleNotch, 
  BookOpen, NotePencil, Desktop, FolderOpen, ListChecks, 
  ChartBar, MapPinLine, Clock, ArrowRight, ChalkboardTeacher
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
  // 🔐 ROLE-BASED ACCESS CONTROL (RBAC)
  // ---------------------------------------------------------
  let tpoData = null;
  try {
    const rawData = localStorage.getItem('tpoData');
    if (rawData) tpoData = JSON.parse(rawData);
  } catch(e) { console.error("Error reading tpoData"); }
  
  const userRole = (tpoData?.role || '').toUpperCase();
  const isSuperAdmin = tpoData?.accessType === 'superadmin' || userRole.includes('ADMIN') || userRole.includes('HEAD') || userRole.includes('MANAGER');
  const showReports = isSuperAdmin || userRole === 'TPO';
  const isTpo = userRole.includes('TPO'); 
  const isTrainer = userRole.includes('TRAINER');

  // ---------------------------------------------------------
  // 📊 STATE MANAGEMENT
  // ---------------------------------------------------------
  const [stats, setStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0 });
  const [events, setEvents] = useState([]);
  const [recentPlacements, setRecentPlacements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [trendData, setTrendData] = useState(Array(12).fill({ m: '', Applications: 0, Offers: 0, Placed: 0 }));
  const [domainData, setDomainData] = useState([]);
  const [pipeline, setPipeline] = useState({ applied: 0, interview: 0, offers: 0, placed: 0 });
  const [totalAppsCount, setTotalAppsCount] = useState(0);

  const [allPlaced, setAllPlaced] = useState([]);
  const [trainerLogs, setTrainerLogs] = useState([]);

  const DOMAIN_COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#0ea5e9'];

  // ---------------------------------------------------------
  // ⚙️ DATA PROCESSING
  // ---------------------------------------------------------
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
      if (!deduped[key] || (log.status.toLowerCase().includes('placed') || log.status.toLowerCase().includes('offer'))) {
        deduped[key] = log;
      }
    });
    const uniqueApps = Object.values(deduped);

    setTotalAppsCount(uniqueApps.length);
    const currentYear = new Date().getFullYear();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    
    let newTrend = months.map(m => ({ m, Applications: 0, Offers: 0, Placed: 0 }));
    let domCount = {};
    let pApp = 0, pInt = 0, pOff = 0, pPl = 0;
    const placedRecent = [];

    uniqueApps.forEach(app => {
      const st = (app.status || '').toLowerCase();
      const jSt = (app.joiningStatus || '').toLowerCase();
      
      const isPlaced = st.includes('placed') || st.includes('got offer') || st.includes('offer') || jSt.includes('join');
      const isOffer = st.includes('offer') || isPlaced;
      const isInterview = st.includes('interview') || st.includes('shortlist');
      
      if (isPlaced) placedRecent.push(app);

      if (st.includes('applied') || st.includes('register') || st.includes('pending')) pApp++;
      if (isInterview) pInt++;
      if (st.includes('offer')) pOff++;
      if (isPlaced) pPl++;

      if (isPlaced) {
        let c = getStandardDomain(app.course);
        domCount[c] = (domCount[c] || 0) + 1;
      }

      const d = parseDateRobust(app.date);
      if (d && d.getFullYear() === currentYear) {
        const mIdx = d.getMonth();
        newTrend[mIdx].Applications++;
        if (isOffer) newTrend[mIdx].Offers++;
        if (isPlaced) newTrend[mIdx].Placed++;
      }
    });

    const formattedDomains = Object.keys(domCount).map((k, i) => ({
      name: k, value: domCount[k]
    })).sort((a,b) => b.value - a.value).slice(0, 5); 

    setTrendData(newTrend);
    setDomainData(formattedDomains);
    setPipeline({ applied: pApp, interview: pInt, offers: pOff, placed: pPl });
    
    setAllPlaced(placedRecent);
    
    const sortedRecent = placedRecent.sort((a, b) => {
      return new Date(parseDateRobust(b.date) || 0) - new Date(parseDateRobust(a.date) || 0);
    }).slice(0, 5);
    setRecentPlacements(sortedRecent);
  };

  useEffect(() => {
    if (allPlaced.length === 0) return;
    const interval = setInterval(() => {
      const shuffled = [...allPlaced].sort(() => 0.5 - Math.random());
      setRecentPlacements(shuffled.slice(0, 5));
    }, 60000); 
    return () => clearInterval(interval);
  }, [allPlaced]);

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
          axios.post(`${API_BASE}/api/tpo/dashboard-stats`, reqPayload),
          axios.post(`${API_BASE}/api/tpo/reports`, reqPayload)
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

        if ((localTpo.role || '').toUpperCase().includes('TRAINER') || localTpo.accessType === 'superadmin') {
          try {
            const trRes = await axios.get(`${API_BASE}/api/admin/trainer-logs`);
            if (trRes.data.success) {
              let myLogs = trRes.data.logs;
              if (localTpo.accessType !== 'superadmin') {
                 myLogs = myLogs.filter(l => l.trainerName === localTpo.name);
              }
              setTrainerLogs(myLogs.slice(0, 5));
            }
          } catch (e) { console.error("Failed to load trainer logs"); }
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

  const totalDomain = domainData.reduce((acc, curr) => acc + curr.value, 0);

  // ---------------------------------------------------------
  // 🎨 CUSTOM TOOLTIPS FOR RECHARTS
  // ---------------------------------------------------------
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', padding: '12px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
          {label && <p style={{ color: '#fff', fontWeight: 'bold', margin: '0 0 8px 0', borderBottom: '1px solid #334155', paddingBottom: '6px', fontSize: '0.9rem' }}>{label} {new Date().getFullYear()}</p>}
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.8rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }}></div>
              <span style={{ color: '#cbd5e1' }}>{entry.name}:</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
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

        {/* 3. PREMIUM INTERACTIVE CHARTS INTEGRATED INTO TIGHT GRID */}
        <div className="grid-3-col" style={{ marginBottom: '20px' }}>
          
          {/* AREA CHART */}
          <div className="dash-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
            <div className="card-top" style={{ marginBottom: '10px' }}>
              <h3>Placement Trends ({new Date().getFullYear()})</h3>
              <select className="mini-select"><option>This Year</option></select>
            </div>
            
            <div style={{ flex: 1, width: '100%', minHeight: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOff" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="m" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Applications" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorApps)" activeDot={{ r: 5, fill: '#a855f7', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="Offers" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorOff)" activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="Placed" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPl)" activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: '15px', marginTop: '15px' }}>
              <div><div className="stat-lbl">Total Applications</div><div className="stat-val">{totalAppsCount}</div></div>
              <div><div className="stat-lbl">Active Interviews</div><div className="stat-val">{pipeline.interview}</div></div>
              <div><div className="stat-lbl">Total Offers</div><div className="stat-val">{pipeline.offers}</div></div>
              <div><div className="stat-lbl">Total Placements</div><div className="stat-val">{stats.placed}</div></div>
            </div>
          </div>

          {/* DONUT CHART */}
          <div className="dash-card">
            <h3>Placements by Domain</h3>
            
            <div style={{ width: '100%', height: '170px', position: 'relative', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie data={domainData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                    {domainData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={DOMAIN_COLORS[index % DOMAIN_COLORS.length]} /> ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>{stats.placed}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Total</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
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

        {/* 4. ORIGINAL GRID-2-COL (Quick Access & Pipeline) */}
        <div className="grid-2-col" style={{ marginBottom: '20px' }}>
          
          <div className="dash-card">
            <h3>Quick Access</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '15px' }}>
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

        {/* 5. LISTS & LOGS */}
        <div className="grid-3-col" style={{ marginBottom: '30px' }}>
          
          <div className="dash-card" style={{ gridColumn: 'span 2' }}>
            <div className="card-top">
              <h3>Recent Placement Activity</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '12px' }}><CircleNotch size={12} className="ph-spin" /> Live Updates</span>
                <button className="text-link" onClick={()=>navigate('/placed')}>View All</button>
              </div>
            </div>
            <table className="mini-table">
              <thead><tr><th>Student</th><th>Company</th><th>Role</th><th style={{textAlign:'right'}}>Package</th><th style={{textAlign:'right'}}>Status</th></tr></thead>
              <tbody>
                {recentPlacements.length > 0 ? recentPlacements.map((p, i) => (
                  <tr key={i} style={{ animation: 'fadeInReveal 0.5s ease' }}>
                    <td><div style={{display:'flex', alignItems:'center', gap:'8px'}}><div className="tiny-avatar">{p.name.charAt(0)}</div> <span style={{color:'#fff'}}>{p.name}</span></div></td>
                    <td><span style={{color:'#3b82f6', fontWeight:'bold'}}>{p.company}</span></td>
                    <td>{p.course}</td>
                    <td style={{textAlign:'right', fontWeight:'bold', color:'#fff'}}>
                      {p.packageLpa ? `${String(p.packageLpa).toUpperCase().replace('LPA', '').trim()} LPA` : '-'}
                    </td>
                    <td style={{textAlign:'right'}}><span className="status-badge green">{(p.status||'Placed').toUpperCase()}</span></td>
                  </tr>
                )) : <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>No records found</td></tr>}
              </tbody>
            </table>
          </div>

          {/* ✨ NEW UPCOMING SCHEDULE DESIGN INJECTED HERE */}
          <div className="dash-card">
            <div className="card-top">
              <h3>Upcoming Schedule</h3>
              <button className="text-link" onClick={()=>navigate('/events')}>Calendar →</button>
            </div>
            
            <div className="list-container" style={{ marginTop: '5px' }}>
              {upcomingEvents.length === 0 ? <div className="empty-state">No upcoming events scheduled.</div> : 
                upcomingEvents.map((evt, i) => {
                  const dateObj = parseDateRobust(evt.date);
                  return (
                  <div key={i} className="list-row hover-bg" style={{ alignItems: 'flex-start' }}>
                    <div className="row-left">
                      <div className="calendar-box">
                        <span className="cal-month">{dateObj ? dateObj.toLocaleString('en-us', { month: 'short' }) : 'TBD'}</span>
                        <span className="cal-day">{dateObj ? dateObj.getDate() : '-'}</span>
                      </div>
                      <div style={{ paddingRight: '10px' }}>
                        <div className="row-title" style={{ whiteSpace: 'normal', lineHeight: '1.2' }}>{evt.title}</div>
                        <div className="row-sub" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <MapPinLine size={12} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.location || 'Online'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="row-right" style={{ paddingTop: '2px' }}>
                      <span className={`status-pill ${evt.type.toLowerCase().includes('drive') ? 'blue' : 'purple'}`}>
                        {evt.type}
                      </span>
                    </div>
                  </div>
                )})}
            </div>
          </div>
        </div>

        {/* 6. TRAINER LOGS (If applicable) */}
        {(isTrainer || isSuperAdmin) && (
          <div className="dash-card" style={{ marginBottom: '20px' }}>
            <div className="card-top">
              <h3>{isSuperAdmin ? "Global Trainer Reports" : "My Daily Reports"}</h3>
              <button className="text-link" onClick={() => navigate('/trainer-logs')}>View All</button>
            </div>
            <table className="mini-table">
              <thead><tr><th>Date</th><th>Present</th><th>Absent</th><th>Remarks</th></tr></thead>
              <tbody>
                {trainerLogs.length > 0 ? trainerLogs.map((l, i) => (
                  <tr key={i}>
                    <td><span className="primary-text">{l.timestamp.split(' ')[0]}</span></td>
                    <td style={{ color: '#10b981', fontWeight: 'bold' }}>{l.present}</td>
                    <td style={{ color: '#ef4444', fontWeight: 'bold' }}>{l.absentees}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.feedbacks || '-'}</td>
                  </tr>
                )) : <tr><td colSpan="4" style={{textAlign:'center', padding:'20px'}}>No logs submitted yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. BOTTOM MODULE CARDS */}
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

        {/* ---------------------------------------------------------
            🎨 ORIGINAL STYLES + NEW SCHEDULE STYLES
        --------------------------------------------------------- */}
        <style>{`
          .db-wrapper { font-family: 'Inter', sans-serif; }
          .dash-card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; }
          .dash-card h3 { margin: 0; font-size: 1rem; color: #fff; }
          
          @keyframes fadeInReveal {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
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

          .mini-table th { border-bottom: 1px solid #1e293b; color: #64748b; font-size: 0.75rem; padding-bottom: 10px; font-weight: normal; text-align: left; }
          .mini-table td { padding: 12px 0; border-bottom: 1px solid #1e293b; font-size: 0.85rem; color: #cbd5e1; }
          .tiny-avatar { width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; }
          .status-badge.green { background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; }

          .text-link { background: transparent; border: none; color: #3b82f6; font-size: 0.8rem; cursor: pointer; font-weight: bold; transition: 0.2s; }
          .text-link:hover { text-decoration: underline; color: #60a5fa; }

          .qa-box { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; font-size: 0.7rem; color: #cbd5e1; font-weight: bold; }
          .qa-icon { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #1e293b; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.2s; }
          .qa-box:hover .qa-icon { border-color: #3b82f6; transform: translateY(-2px); }
          .qa-icon.blue { color: #3b82f6; } .qa-icon.green { color: #10b981; } .qa-icon.orange { color: #f59e0b; } .qa-icon.pink { color: #ec4899; } .qa-icon.teal { color: #0ea5e9; } .qa-icon.purple { color: #a855f7; } .qa-icon.yellow { color: #eab308; }

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

          /* NEW UPCOMING SCHEDULE STYLES */
          .list-container { display: flex; flex-direction: column; gap: 8px; }
          .list-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid transparent; transition: 0.2s; }
          .hover-bg:hover { background: #1e293b; border-color: #334155; }
          .row-left { display: flex; align-items: center; gap: 12px; }
          
          .calendar-box { background: #0f1523; border: 1px solid #1e293b; border-radius: 6px; width: 42px; height: 42px; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
          .cal-month { background: #3b82f6; color: #fff; width: 100%; text-align: center; font-size: 0.55rem; font-weight: bold; text-transform: uppercase; padding: 2px 0; }
          .cal-day { font-size: 1rem; font-weight: 800; color: #fff; padding: 2px 0; }
          
          .row-title { color: #fff; font-weight: 600; font-size: 0.85rem; margin-bottom: 2px; }
          .row-sub { color: #64748b; font-size: 0.75rem; line-height: 1.2; }
          
          .status-pill { padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; white-space: nowrap; }
          .status-pill.blue { background: rgba(59,130,246,0.1); color: #3b82f6; }
          .status-pill.purple { background: rgba(168,85,247,0.1); color: #a855f7; }
          
          .empty-state { text-align: center; padding: 20px; color: #64748b; font-size: 0.8rem; border: 1px dashed #334155; border-radius: 8px; }
        `}</style>
      </div>
    </Layout>
  );
}