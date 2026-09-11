import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Trophy, CalendarCheck, CircleNotch, 
  BookOpen, NotePencil, Desktop, FolderOpen, ListChecks, 
  ChartBar, MapPinLine, Clock, Student, ChalkboardTeacher,
  WarningCircle, Buildings, TrendUp, Target
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
  const accessType = (tpoData?.accessType || '').toLowerCase();
  
  const isSuperAdmin = accessType === 'superadmin' || userRole.includes('ADMIN') || userRole.includes('HEAD') || userRole.includes('MANAGER');
  const isTpo = userRole.includes('TPO') || isSuperAdmin; 
  const isTrainer = userRole.includes('TRAINER') || userRole.includes('TTH') || isSuperAdmin;
  const showReports = isSuperAdmin || userRole === 'TPO';

  // ---------------------------------------------------------
  // 📊 STATE MANAGEMENT
  // ---------------------------------------------------------
  const [stats, setStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0 });
  const [events, setEvents] = useState([]);
  const [recentPlacements, setRecentPlacements] = useState([]);
  const [activeIssues, setActiveIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [trendData, setTrendData] = useState(Array(12).fill({ m: '', Applications: 0, Offers: 0, Placed: 0 }));
  const [domainData, setDomainData] = useState([]);
  const [topCompanies, setTopCompanies] = useState([]);
  const [pipeline, setPipeline] = useState({ applied: 0, interview: 0, offers: 0, placed: 0 });
  const [totalAppsCount, setTotalAppsCount] = useState(0);
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
    let compCount = {};
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
        if (app.company && app.company.toLowerCase() !== 'unknown company') {
          compCount[app.company] = (compCount[app.company] || 0) + 1;
        }
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

    const topComps = Object.keys(compCount).map(k => ({
      name: k, count: compCount[k]
    })).sort((a,b) => b.count - a.count).slice(0, 3);

    setTrendData(newTrend);
    setDomainData(formattedDomains);
    setTopCompanies(topComps);
    setPipeline({ applied: pApp, interview: pInt, offers: pOff, placed: pPl });
    
    setAllPlaced(placedRecent);
    const sortedRecent = placedRecent.sort((a, b) => {
      return new Date(parseDateRobust(b.date) || 0) - new Date(parseDateRobust(a.date) || 0);
    }).slice(0, 6);
    setRecentPlacements(sortedRecent);
  };

  useEffect(() => {
    if (!tpoData) return;

    const fetchData = async () => {
      try {
        const reqPayload = { 
          assignedBranchesArray: tpoData.assignedBranchesArray, 
          role: tpoData.role, 
          assignedCourse: tpoData.assignedCourse, 
          tpoName: tpoData.name 
        };
        
        const [statsRes, reportsRes] = await Promise.all([
          axios.post(`${API_BASE}/api/tpo/dashboard-stats`, reqPayload),
          axios.post(`${API_BASE}/api/tpo/reports`, reqPayload)
        ]);
        
        if (statsRes.data.success) {
          setStats(statsRes.data.stats);
          setEvents(statsRes.data.events || []);
        }

        if (reportsRes.data.success) {
          processApps(reportsRes.data.tpoLogs || []);
          const unresIssues = (reportsRes.data.issues || []).filter(i => (i.status||'').toLowerCase() !== 'resolved');
          setActiveIssues(unresIssues.slice(0, 4));
        }

        if (isTrainer) {
          const trRes = await axios.get(`${API_BASE}/api/admin/trainer-logs`);
          if (trRes.data.success) {
            let myLogs = trRes.data.logs;
            if (!isSuperAdmin) myLogs = myLogs.filter(l => l.trainerName === tpoData.name);
            setTrainerLogs(myLogs.slice(0, 5));
          }
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
  }).sort((a,b) => parseDateRobust(a.date) - parseDateRobust(b.date)).slice(0, 4);

  const placementRate = stats.totalStudents > 0 ? ((stats.placed / stats.totalStudents) * 100).toFixed(1) : '0.0';

  // ---------------------------------------------------------
  // 🎨 CUSTOM TOOLTIPS FOR RECHARTS
  // ---------------------------------------------------------
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '15px', borderRadius: '12px', backdropFilter: 'blur(16px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <p style={{ color: '#fff', fontWeight: 'bold', margin: '0 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', fontSize: '0.9rem' }}>{label} {new Date().getFullYear()}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '0.85rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}` }}></div>
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
      <div className="db-wrapper" style={{ paddingBottom: '40px', maxWidth: '1800px', margin: '0 auto', width: '100%' }}>
        
        {/* ---------------------------------------------------------
            1. PREMIUM WELCOME HEADER
        --------------------------------------------------------- */}
        <div className="welcome-header">
          <div>
            <h1 style={{ fontSize: '2.4rem', margin: '0 0 8px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '15px', fontWeight: '800' }}>
              Welcome back, {tpoData?.name?.split(' ')[0] || 'Officer'} <span className="wave-emoji">👋</span>
              <span className="role-badge pulse-glow">{userRole || 'STAFF'}</span>
            </h1>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '1.05rem' }}>Real-time ecosystem overview for your assigned branches.</p>
          </div>
          <div className="date-pill glass-panel">
            <Clock size={18} weight="fill" color="#3b82f6" /> 
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* ---------------------------------------------------------
            2. TOP KPI METRICS (4 CARDS)
        --------------------------------------------------------- */}
        <div className="bento-grid" style={{ marginBottom: '24px' }}>
          <div className="kpi-card bento-col-3 glass-panel hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Total Students</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.totalStudents}</div></div>
              <div className="kpi-icon blue"><Student weight="fill" size={26}/></div>
            </div>
            <div className="kpi-bottom"><span className="trend-up">↑ Live Sync</span> Database active</div>
          </div>
          
          <div className="kpi-card bento-col-3 glass-panel hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Active Vacancies</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.activeVacancies}</div></div>
              <div className="kpi-icon green"><Briefcase weight="fill" size={26}/></div>
            </div>
            <div className="kpi-bottom"><span className="trend-up">↑ Hiring</span> Open jobs in portal</div>
          </div>

          <div className="kpi-card bento-col-3 glass-panel hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Students Placed</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.placed}</div></div>
              <div className="kpi-icon purple"><Trophy weight="fill" size={26}/></div>
            </div>
            <div className="kpi-bottom"><span className="trend-up">↑ Growing</span> Placement pipeline</div>
          </div>

          <div className="kpi-card bento-col-3 glass-panel hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Conversion Rate</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : `${placementRate}%`}</div></div>
              <div className="kpi-icon orange"><ChartBar weight="fill" size={26}/></div>
            </div>
            <div className="kpi-bottom"><span className="trend-up">↑ Performance</span> Global average</div>
          </div>
        </div>

        {/* ---------------------------------------------------------
            3. MAIN CHARTS (AREA + DONUT)
        --------------------------------------------------------- */}
        <div className="bento-grid" style={{ marginBottom: '24px' }}>
          
          {/* AREA CHART (Spans 8 columns) */}
          <div className="bento-col-8 glass-panel premium-card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Placement Activity Trends</h3>
                <p className="card-subtitle">Interactive application and offer velocity for {new Date().getFullYear()}</p>
              </div>
              <select className="premium-select"><option>This Year</option></select>
            </div>
            
            <div style={{ width: '100%', height: '320px', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOff" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="m" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Applications" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorApps)" activeDot={{ r: 6, fill: '#a855f7', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="Offers" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOff)" activeDot={{ r: 6, fill: '#10b981', strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="Placed" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPl)" activeDot={{ r: 6, fill: '#3b82f6', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DONUT CHART (Spans 4 columns) */}
          <div className="bento-col-4 glass-panel premium-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: '0' }}>
              <div>
                <h3 className="card-title">Placements by Domain</h3>
                <p className="card-subtitle">Distribution of successful offers</p>
              </div>
            </div>
            
            <div style={{ width: '100%', flex: 1, minHeight: '200px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie data={domainData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">
                    {domainData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={DOMAIN_COLORS[index % DOMAIN_COLORS.length]} /> ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <div className="donut-val">{stats.placed}</div>
                <div className="donut-lbl">Total</div>
              </div>
            </div>

            <div className="domain-legend">
              {domainData.length === 0 ? <div style={{textAlign:'center', color:'#64748b'}}>No data yet</div> : 
                domainData.map((d, i) => (
                <div key={d.name} className="legend-item hover-bg">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: DOMAIN_COLORS[i % DOMAIN_COLORS.length], boxShadow: `0 0 8px ${DOMAIN_COLORS[i % DOMAIN_COLORS.length]}` }}></span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{d.name}</span>
                  </div>
                  <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{d.value}</strong>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ---------------------------------------------------------
            4. PIPELINE, QUICK ACCESS, & TOP RECRUITERS
        --------------------------------------------------------- */}
        <div className="bento-grid" style={{ marginBottom: '24px' }}>
          
          <div className="bento-col-8 glass-panel premium-card">
            <h3 className="card-title" style={{ marginBottom: '20px' }}>Application Funnel Matrix</h3>
            
            <div className="pipeline-container">
              <div className="pipe-stage hover-lift">
                <div className="pipe-icon" style={{ color: '#a855f7', background: 'rgba(168,85,247,0.1)' }}><NotePencil size={24} weight="fill"/></div>
                <div className="pipe-data">
                  <div className="pipe-val">{pipeline.applied}</div><div className="pipe-lbl">Applied</div>
                </div>
              </div>
              <div className="pipe-arrow">➔</div>
              
              <div className="pipe-stage hover-lift">
                <div className="pipe-icon" style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)' }}><Users size={24} weight="fill"/></div>
                <div className="pipe-data">
                  <div className="pipe-val">{pipeline.interview}</div><div className="pipe-lbl">Interviews</div>
                </div>
              </div>
              <div className="pipe-arrow">➔</div>

              <div className="pipe-stage hover-lift">
                <div className="pipe-icon" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }}><Briefcase size={24} weight="fill"/></div>
                <div className="pipe-data">
                  <div className="pipe-val">{pipeline.offers}</div><div className="pipe-lbl">Offers</div>
                </div>
              </div>
              <div className="pipe-arrow">➔</div>

              <div className="pipe-stage hover-lift">
                <div className="pipe-icon" style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)' }}><Trophy size={24} weight="fill"/></div>
                <div className="pipe-data">
                  <div className="pipe-val">{pipeline.placed}</div><div className="pipe-lbl">Placed</div>
                </div>
              </div>
            </div>

            <div className="conversion-metrics">
              <div className="metric-box">
                <span>App ➔ Interview</span>
                <strong style={{ color: '#3b82f6' }}>{pipeline.applied ? ((pipeline.interview/pipeline.applied)*100).toFixed(1) : 0}%</strong>
              </div>
              <div className="metric-box">
                <span>Interview ➔ Offer</span>
                <strong style={{ color: '#a855f7' }}>{pipeline.interview ? ((pipeline.offers/pipeline.interview)*100).toFixed(1) : 0}%</strong>
              </div>
              <div className="metric-box">
                <span>Offer ➔ Placed</span>
                <strong style={{ color: '#10b981' }}>{pipeline.offers ? ((pipeline.placed/pipeline.offers)*100).toFixed(1) : 0}%</strong>
              </div>
            </div>
          </div>

          <div className="bento-col-4 glass-panel premium-card">
            <h3 className="card-title" style={{ marginBottom: '15px' }}>Role-Based Quick Actions</h3>
            <div className="quick-access-grid">
              
              <div className="qa-btn hover-lift" onClick={()=>navigate('/students')}>
                <div className="qa-icon blue"><Student weight="fill"/></div><span>Students</span>
              </div>
              <div className="qa-btn hover-lift" onClick={()=>navigate('/exams')}>
                <div className="qa-icon orange"><NotePencil weight="fill"/></div><span>Exams</span>
              </div>
              <div className="qa-btn hover-lift" onClick={()=>navigate('/study-materials')}>
                <div className="qa-icon pink"><BookOpen weight="fill"/></div><span>Materials</span>
              </div>
              <div className="qa-btn hover-lift" onClick={()=>navigate('/clients')}>
                <div className="qa-icon teal"><FolderOpen weight="fill"/></div><span>Documents</span>
              </div>

              {isTpo && (
                <>
                  <div className="qa-btn hover-lift" onClick={()=>navigate('/placement-drives')}>
                    <div className="qa-icon purple"><CalendarCheck weight="fill"/></div><span>Drives</span>
                  </div>
                  <div className="qa-btn hover-lift" onClick={()=>navigate('/tracker')}>
                    <div className="qa-icon green"><ListChecks weight="fill"/></div><span>Tracker</span>
                  </div>
                  <div className="qa-btn hover-lift" onClick={()=>navigate('/talentino')}>
                    <div className="qa-icon yellow"><Users weight="fill"/></div><span>Talentino</span>
                  </div>
                </>
              )}

              {isSuperAdmin && (
                <div className="qa-btn hover-lift" onClick={()=>navigate('/reports')}>
                  <div className="qa-icon blue"><ChartBar weight="fill"/></div><span>Reports</span>
                </div>
              )}

              {isTrainer && !isSuperAdmin && (
                <div className="qa-btn hover-lift" onClick={()=>navigate('/trainer-logs')}>
                  <div className="qa-icon green"><ChalkboardTeacher weight="fill"/></div><span>My Logs</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ---------------------------------------------------------
            5. LIST MODULES (PLACEMENTS, SCHEDULES, ISSUES)
        --------------------------------------------------------- */}
        <div className="bento-grid">
          
          {/* RECENT PLACEMENTS (Spans 4) */}
          <div className="bento-col-4 glass-panel premium-card flex-col">
            <div className="card-header">
              <h3 className="card-title">Live Placement Feed</h3>
              <button className="premium-text-btn" onClick={()=>navigate('/placed')}>View All →</button>
            </div>
            <div className="list-container flex-1">
              {recentPlacements.length > 0 ? recentPlacements.map((p, i) => (
                <div key={i} className="list-row hover-bg">
                  <div className="row-left">
                    <div className="avatar-circle">{p.name.charAt(0)}</div>
                    <div className="text-truncate">
                      <div className="row-title">{p.name}</div>
                      <div className="row-sub">{p.course}</div>
                    </div>
                  </div>
                  <div className="row-right">
                    <div className="row-title text-blue" style={{ fontSize: '0.85rem' }}>{p.company}</div>
                    <div className="row-sub" style={{ fontSize: '0.75rem' }}>{p.packageLpa ? `${String(p.packageLpa).toUpperCase().replace('LPA', '').trim()} LPA` : 'Offer Received'}</div>
                  </div>
                </div>
              )) : <div className="empty-state">No recent placements found.</div>}
            </div>
          </div>

          {/* UPCOMING SCHEDULE (Spans 4) */}
          <div className="bento-col-4 glass-panel premium-card flex-col">
            <div className="card-header">
              <div>
                <h3 className="card-title">Upcoming Schedule</h3>
                <p className="card-subtitle">Placement Drives & Talentino</p>
              </div>
              <button className="premium-text-btn" onClick={()=>navigate('/events')}>Calendar →</button>
            </div>
            
            <div className="list-container flex-1">
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
                      <div className="text-truncate" style={{ paddingRight: '10px' }}>
                        <div className="row-title" style={{ whiteSpace: 'normal', lineHeight: '1.3' }}>{evt.title}</div>
                        <div className="row-sub" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <MapPinLine size={12} /> <span className="text-truncate">{evt.location || 'Online'}</span>
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

          {/* THIRD COLUMN: ACTION CENTER (Spans 4) */}
          <div className="bento-col-4 glass-panel premium-card flex-col">
            
            {(isSuperAdmin || isTpo) && !isTrainer ? (
              <>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Action Center</h3>
                    <p className="card-subtitle">Active Student Support Tickets</p>
                  </div>
                  <button className="premium-text-btn" onClick={()=>navigate('/issues')}>Resolve →</button>
                </div>
                <div className="list-container flex-1">
                  {activeIssues.length > 0 ? activeIssues.map((issue, i) => (
                    <div key={i} className="list-row hover-bg" style={{ borderLeft: '3px solid #ef4444' }}>
                      <div className="row-left text-truncate">
                        <div className="icon-circle red"><WarningCircle weight="bold"/></div>
                        <div className="text-truncate">
                          <div className="row-title">{issue.name} ({issue.branch})</div>
                          <div className="row-sub">{issue.details}</div>
                        </div>
                      </div>
                    </div>
                  )) : <div className="empty-state">🎉 All clear! No active student issues.</div>}
                  
                  {/* Top Recruiters Mini-Widget to fill space */}
                  {topCompanies.length > 0 && (
                    <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <h4 style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 10px 0', textTransform: 'uppercase' }}>Top Hiring Partners</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {topCompanies.map(c => (
                          <span key={c.name} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            <Buildings size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/> {c.name} ({c.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* TRAINER VIEW: My Logs */}
                <div className="card-header">
                  <h3 className="card-title">My Recent Trainer Logs</h3>
                  <button className="premium-text-btn" onClick={()=>navigate('/trainer-logs')}>History →</button>
                </div>
                <div className="list-container flex-1">
                  {trainerLogs.length > 0 ? trainerLogs.map((l, i) => (
                    <div key={i} className="list-row hover-bg">
                      <div className="row-left">
                        <div className="icon-circle green"><ChalkboardTeacher weight="fill"/></div>
                        <div className="text-truncate">
                          <div className="row-title">{l.course}</div>
                          <div className="row-sub">{l.timestamp.split(' ')[0]}</div>
                        </div>
                      </div>
                      <div className="row-right" style={{ display: 'flex', gap: '5px' }}>
                        <span className="status-pill green">{l.present} P</span>
                        <span className="status-pill red">{l.absentees} A</span>
                      </div>
                    </div>
                  )) : <div className="empty-state">No logs submitted recently.</div>}
                </div>
              </>
            )}

          </div>

        </div>

        {/* ---------------------------------------------------------
            🎨 PREMIUM 12-COLUMN STYLESHEET
        --------------------------------------------------------- */}
        <style>{`
          .db-wrapper { font-family: 'Inter', sans-serif; }
          
          /* Bento Grid System */
          .bento-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 24px; }
          .bento-col-3 { grid-column: span 3; }
          .bento-col-4 { grid-column: span 4; }
          .bento-col-8 { grid-column: span 8; }
          
          @media (max-width: 1400px) {
            .bento-col-3 { grid-column: span 6; }
          }
          @media (max-width: 1100px) {
            .bento-col-4, .bento-col-8 { grid-column: span 12; }
            .bento-col-3 { grid-column: span 6; }
            .pipeline-container { flex-direction: column; align-items: stretch !important; gap: 15px; }
            .pipe-arrow { transform: rotate(90deg); margin: 0 auto; }
          }
          @media (max-width: 600px) {
            .bento-col-3 { grid-column: span 12; }
          }

          /* Glassmorphism & Premium Cards */
          .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
          .premium-card { border-radius: 20px; padding: 25px; display: flex; flex-direction: column; overflow: hidden; }
          .premium-shadow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5); }
          .hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); cursor: default; }
          .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.8); }
          .flex-col { display: flex; flex-direction: column; }
          .flex-1 { flex: 1; }
          .text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
          
          /* Header Elements */
          .welcome-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; flex-wrap: wrap; gap: 15px; }
          .role-badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; letter-spacing: 1px; }
          .pulse-glow { animation: pulseGlow 2s infinite; }
          @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(56, 189, 248, 0); } 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); } }
          .date-pill { padding: 10px 20px; border-radius: 30px; color: #e2e8f0; font-size: 0.95rem; display: flex; align-items: center; gap: 10px; font-weight: 600; border: 1px solid rgba(255,255,255,0.05); }
          
          /* KPI Cards */
          .kpi-card { border-radius: 20px; padding: 25px; }
          .kpi-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
          .kpi-title { font-size: 0.8rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .kpi-val { font-size: 2.4rem; font-weight: 900; color: #fff; line-height: 1; text-shadow: 0 2px 10px rgba(0,0,0,0.3); }
          .kpi-icon { width: 50px; height: 50px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 10px rgba(255,255,255,0.05); }
          .kpi-icon.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
          .kpi-icon.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
          .kpi-icon.purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); }
          .kpi-icon.orange { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
          .kpi-bottom { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px; font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 8px; font-weight: 500; }
          .trend-up { color: #10b981; font-weight: bold; background: rgba(16, 185, 129, 0.1); padding: 4px 8px; border-radius: 6px; }
          
          /* Card Internals */
          .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; width: 100%; }
          .card-title { margin: 0; font-size: 1.15rem; color: #fff; font-weight: 800; letter-spacing: 0.5px; }
          .card-subtitle { margin: 5px 0 0 0; font-size: 0.85rem; color: #64748b; font-weight: 500; }
          .premium-select { background: #0f1523; color: #fff; border: 1px solid #334155; border-radius: 8px; padding: 6px 14px; font-size: 0.85rem; outline: none; cursor: pointer; font-weight: 600; transition: 0.2s; }
          .premium-select:hover { border-color: #3b82f6; }
          .premium-text-btn { background: transparent; border: none; color: #3b82f6; font-size: 0.9rem; cursor: pointer; font-weight: bold; transition: 0.2s; padding: 4px 8px; border-radius: 6px; }
          .premium-text-btn:hover { background: rgba(59, 130, 246, 0.1); transform: translateX(3px); }
          
          /* Donut Chart & Legends */
          .donut-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
          .donut-val { font-size: 2rem; font-weight: 900; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
          .donut-lbl { font-size: 0.75rem; color: #94a3b8; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          .domain-legend { display: flex; flex-direction: column; gap: 8px; margin-top: 15px; }
          .legend-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-radius: 10px; border: 1px solid transparent; transition: 0.2s; background: rgba(255,255,255,0.02); }
          
          /* PIPELINE */
          .pipeline-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; padding: 25px; background: rgba(0, 0, 0, 0.2); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); }
          .pipe-stage { display: flex; align-items: center; gap: 15px; padding: 10px 15px; border-radius: 12px; }
          .pipe-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid; }
          .pipe-data { text-align: left; }
          .pipe-val { font-size: 1.6rem; font-weight: 900; color: #fff; line-height: 1; margin-bottom: 4px; }
          .pipe-lbl { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
          .pipe-arrow { color: #475569; font-size: 1.2rem; font-weight: bold; }
          
          .conversion-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
          .metric-box { background: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 6px; }
          .metric-box span { color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
          .metric-box strong { font-size: 1.4rem; font-weight: 900; }
          
          /* QUICK ACCESS GRID */
          .quick-access-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; }
          .qa-btn { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; cursor: pointer; color: #cbd5e1; font-weight: 700; font-size: 0.8rem; text-align: center; transition: 0.2s; }
          .qa-btn:hover { background: rgba(59, 130, 246, 0.1); color: #fff; border-color: rgba(59, 130, 246, 0.3); }
          .qa-btn:hover .qa-icon { background: #3b82f6; color: #fff; border-color: transparent; box-shadow: 0 5px 15px rgba(59, 130, 246, 0.4); }
          .qa-icon { width: 42px; height: 42px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: #0f1523; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.3s; }
          .qa-icon.blue { color: #3b82f6; } .qa-icon.orange { color: #f59e0b; } .qa-icon.pink { color: #ec4899; } .qa-icon.teal { color: #0ea5e9; } .qa-icon.purple { color: #a855f7; } .qa-icon.green { color: #10b981; } .qa-icon.yellow { color: #eab308; }
          
          /* LIST STYLES */
          .list-container { display: flex; flex-direction: column; gap: 10px; }
          .list-row { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255,255,255,0.02); border-radius: 12px; transition: 0.2s; }
          .hover-bg:hover { background: rgba(255, 255, 255, 0.05); border-color: rgba(255,255,255,0.1); }
          .row-left { display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0; }
          .avatar-circle { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem; flex-shrink: 0; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }
          .icon-circle { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }
          .icon-circle.green { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
          .icon-circle.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
          .row-title { color: #fff; font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; }
          .row-sub { color: #94a3b8; font-size: 0.8rem; font-weight: 500; }
          .text-blue { color: #3b82f6; font-weight: 800; }
          
          .calendar-box { background: #0f1523; border: 1px solid #1e293b; border-radius: 10px; width: 48px; height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: inset 0 2px 5px rgba(0,0,0,0.5); }
          .cal-month { background: #3b82f6; color: #fff; width: 100%; text-align: center; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; padding: 3px 0; letter-spacing: 0.5px; }
          .cal-day { font-size: 1.1rem; font-weight: 900; color: #fff; padding: 2px 0; }
          
          .status-pill { padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; white-space: nowrap; letter-spacing: 0.5px; }
          .status-pill.green { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
          .status-pill.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59,130,246,0.2); }
          .status-pill.purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; border: 1px solid rgba(168,85,247,0.2); }
          .status-pill.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
          
          .empty-state { text-align: center; padding: 30px; color: #64748b; font-size: 0.9rem; font-weight: 600; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; background: rgba(0,0,0,0.1); }
        `}</style>
      </div>
    </Layout>
  );
}