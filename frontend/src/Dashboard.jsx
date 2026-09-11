import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Trophy, CalendarCheck, CircleNotch, 
  BookOpen, NotePencil, Desktop, FolderOpen, ListChecks, 
  ArrowRight, ChartBar, MapPinLine, Clock, Student, ChalkboardTeacher
} from '@phosphor-icons/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
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
  } catch(e) {
    console.error("Error reading tpoData");
  }
  
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
  const [loading, setLoading] = useState(true);

  const [trendData, setTrendData] = useState(Array(12).fill({ m: '', apps: 0, off: 0, pl: 0 }));
  const [domainData, setDomainData] = useState([]);
  const [pipeline, setPipeline] = useState({ applied: 0, interview: 0, offers: 0, placed: 0 });
  const [totalAppsCount, setTotalAppsCount] = useState(0);

  const [allPlaced, setAllPlaced] = useState([]);
  const [trainerLogs, setTrainerLogs] = useState([]);

  // Colors for Domain Donut Chart
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
    if (!tpoData) return;

    const fetchData = async () => {
      const cachedStats = localStorage.getItem('dash_stats');
      const cachedLogs = localStorage.getItem('dash_logs');
      if (cachedStats) setStats(JSON.parse(cachedStats));
      if (cachedLogs) { processApps(JSON.parse(cachedLogs)); setLoading(false); }

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
          localStorage.setItem('dash_stats', JSON.stringify(statsRes.data.stats));
          setEvents(statsRes.data.events || []);
        }

        if (reportsRes.data.success) {
          const logs = reportsRes.data.tpoLogs || [];
          localStorage.setItem('dash_logs', JSON.stringify(logs));
          processApps(logs);
        }

        if (isTrainer) {
          try {
            const trRes = await axios.get(`${API_BASE}/api/admin/trainer-logs`);
            if (trRes.data.success) {
              let myLogs = trRes.data.logs;
              if (!isSuperAdmin) {
                 myLogs = myLogs.filter(l => l.trainerName === tpoData.name);
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
  }).sort((a,b) => parseDateRobust(a.date) - parseDateRobust(b.date)).slice(0, 4);

  const upDrivesCount = events.filter(e => (e.type||'').toLowerCase().includes('drive') && parseDateRobust(e.date) >= today).length;
  const placementRate = stats.totalStudents > 0 ? ((stats.placed / stats.totalStudents) * 100).toFixed(1) : '0.0';

  // ---------------------------------------------------------
  // 🎨 CUSTOM TOOLTIPS FOR RECHARTS
  // ---------------------------------------------------------
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', padding: '15px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
          <p style={{ color: '#fff', fontWeight: 'bold', margin: '0 0 10px 0', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>{label} {new Date().getFullYear()}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '0.85rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: entry.color }}></div>
              <span style={{ color: '#cbd5e1' }}>{entry.name}:</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderCalendar = () => {
    const days = [27,28,29,30,1,2,3, 4,5,6,7,8,9,10, 11,12,13,14,15,16,17, 18,19,20,21,22,23,24, 25,26,27,28,29,30,31];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontSize: '0.75rem', marginTop: '15px' }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>{d}</div>)}
        {days.map((d, i) => (
          <div key={i} style={{ 
            padding: '6px', 
            color: (i<4 || i>34) ? '#334155' : '#fff', 
            background: d===today.getDate() && i>3 && i<34 ? '#3b82f6' : 'transparent', 
            borderRadius: '8px', 
            fontWeight: d===today.getDate() ? 'bold' : 'normal',
            boxShadow: d===today.getDate() ? '0 0 15px rgba(59, 130, 246, 0.5)' : 'none'
          }}>{d}</div>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="db-wrapper" style={{ paddingBottom: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* WELCOME HEADER */}
        <div className="welcome-header">
          <div>
            <h1 style={{ fontSize: '2.2rem', margin: '0 0 8px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Welcome back, {tpoData?.name?.split(' ')[0] || 'Officer'} 👋
              <span className="role-badge">{userRole || 'STAFF'}</span>
            </h1>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '1rem' }}>Here's your real-time ecosystem overview for today.</p>
          </div>
          <div className="date-pill">
            <Clock size={18} weight="bold" /> 
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="kpi-grid">
          <div className="kpi-card hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Total Students</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.totalStudents}</div></div>
              <div className="kpi-icon blue"><Student weight="fill" size={24}/></div>
            </div>
            <div className="kpi-bottom"><span className="trend-up">↑ Live Sync</span> across {tpoData?.assignedBranchesArray?.includes('all') ? 'all' : tpoData?.assignedBranchesArray?.length || 1} branches</div>
          </div>
          
          <div className="kpi-card hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Active Vacancies</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.activeVacancies}</div></div>
              <div className="kpi-icon green"><Briefcase weight="fill" size={24}/></div>
            </div>
            <div className="kpi-bottom"><span className="trend-up">↑ Hiring Now</span> in portal</div>
          </div>

          <div className="kpi-card hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Students Placed</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : stats.placed}</div></div>
              <div className="kpi-icon purple"><Trophy weight="fill" size={24}/></div>
            </div>
            <div className="kpi-bottom"><span className="trend-up">↑ Growing</span> placement pipeline</div>
          </div>

          <div className="kpi-card hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Conversion Rate</div><div className="kpi-val">{loading ? <CircleNotch className="ph-spin"/> : `${placementRate}%`}</div></div>
              <div className="kpi-icon orange"><ChartBar weight="fill" size={24}/></div>
            </div>
            <div className="kpi-bottom"><span className="trend-up">↑ Performance</span> global average</div>
          </div>
        </div>

        {/* MAIN CHARTS SECTION */}
        <div className="grid-main-charts">
          
          {/* INTERACTIVE AREA CHART */}
          <div className="dash-card premium-shadow" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Placement Activity Trends</h3>
                <p className="card-subtitle">Interactive application and offer velocity for {new Date().getFullYear()}</p>
              </div>
              <select className="premium-select"><option>This Year</option></select>
            </div>
            
            <div style={{ width: '100%', height: '300px', marginTop: '20px' }}>
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
                  <XAxis dataKey="m" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Applications" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorApps)" activeDot={{ r: 6, strokeWidth: 0, fill: '#a855f7' }} />
                  <Area type="monotone" dataKey="Offers" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOff)" activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                  <Area type="monotone" dataKey="Placed" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPl)" activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* INTERACTIVE DONUT CHART */}
          <div className="dash-card premium-shadow">
            <div className="card-header">
              <div>
                <h3 className="card-title">Placements by Domain</h3>
                <p className="card-subtitle">Distribution of successful offers</p>
              </div>
            </div>
            
            <div style={{ width: '100%', height: '220px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Pie
                    data={domainData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {domainData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={DOMAIN_COLORS[index % DOMAIN_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff' }}>{stats.placed}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Total</div>
              </div>
            </div>

            <div className="domain-legend">
              {domainData.length === 0 ? <div style={{textAlign:'center', color:'#64748b'}}>No data yet</div> : 
                domainData.map((d, i) => (
                <div key={d.name} className="legend-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: DOMAIN_COLORS[i % DOMAIN_COLORS.length] }}></span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>{d.name}</span>
                  </div>
                  <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{d.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PIPELINE & QUICK ACCESS */}
        <div className="grid-main-charts" style={{ marginTop: '20px' }}>
          
          <div className="dash-card premium-shadow">
            <h3 className="card-title" style={{ marginBottom: '20px' }}>Application Funnel</h3>
            
            <div className="pipeline-container">
              <div className="pipe-stage">
                <div className="pipe-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', borderColor: 'rgba(168, 85, 247, 0.3)' }}><NotePencil size={20} weight="fill"/></div>
                <div className="pipe-data">
                  <div className="pipe-val">{pipeline.applied}</div>
                  <div className="pipe-lbl">Applied</div>
                </div>
              </div>
              <div className="pipe-arrow">➔</div>
              
              <div className="pipe-stage">
                <div className="pipe-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.3)' }}><Users size={20} weight="fill"/></div>
                <div className="pipe-data">
                  <div className="pipe-val">{pipeline.interview}</div>
                  <div className="pipe-lbl">Interviews</div>
                </div>
              </div>
              <div className="pipe-arrow">➔</div>

              <div className="pipe-stage">
                <div className="pipe-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}><Briefcase size={20} weight="fill"/></div>
                <div className="pipe-data">
                  <div className="pipe-val">{pipeline.offers}</div>
                  <div className="pipe-lbl">Offers</div>
                </div>
              </div>
              <div className="pipe-arrow">➔</div>

              <div className="pipe-stage">
                <div className="pipe-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}><Trophy size={20} weight="fill"/></div>
                <div className="pipe-data">
                  <div className="pipe-val">{pipeline.placed}</div>
                  <div className="pipe-lbl">Placed</div>
                </div>
              </div>
            </div>

            <div className="conversion-metrics">
              <div className="metric-box">
                <span>App to Interview</span>
                <strong>{pipeline.applied ? ((pipeline.interview/pipeline.applied)*100).toFixed(1) : 0}%</strong>
              </div>
              <div className="metric-box">
                <span>Interview to Offer</span>
                <strong>{pipeline.interview ? ((pipeline.offers/pipeline.interview)*100).toFixed(1) : 0}%</strong>
              </div>
              <div className="metric-box">
                <span>Offer to Placed</span>
                <strong>{pipeline.offers ? ((pipeline.placed/pipeline.offers)*100).toFixed(1) : 0}%</strong>
              </div>
            </div>
          </div>

          <div className="dash-card premium-shadow">
            <h3 className="card-title" style={{ marginBottom: '20px' }}>Role-Based Quick Actions</h3>
            <div className="quick-access-grid">
              
              {/* EVERYONE SEES THESE */}
              <div className="qa-btn hover-lift" onClick={()=>navigate('/students')}>
                <div className="qa-icon blue"><Student weight="fill"/></div>
                <span>Students</span>
              </div>
              <div className="qa-btn hover-lift" onClick={()=>navigate('/exams')}>
                <div className="qa-icon orange"><NotePencil weight="fill"/></div>
                <span>Exams</span>
              </div>
              <div className="qa-btn hover-lift" onClick={()=>navigate('/study-materials')}>
                <div className="qa-icon pink"><BookOpen weight="fill"/></div>
                <span>Materials</span>
              </div>
              <div className="qa-btn hover-lift" onClick={()=>navigate('/clients')}>
                <div className="qa-icon teal"><FolderOpen weight="fill"/></div>
                <span>Documents</span>
              </div>

              {/* ONLY TPOS AND ADMINS SEE THESE */}
              {isTpo && (
                <>
                  <div className="qa-btn hover-lift" onClick={()=>navigate('/placement-drives')}>
                    <div className="qa-icon purple"><CalendarCheck weight="fill"/></div>
                    <span>Drives</span>
                  </div>
                  <div className="qa-btn hover-lift" onClick={()=>navigate('/tracker')}>
                    <div className="qa-icon green"><ListChecks weight="fill"/></div>
                    <span>Tracker</span>
                  </div>
                  <div className="qa-btn hover-lift" onClick={()=>navigate('/talentino')}>
                    <div className="qa-icon yellow"><Users weight="fill"/></div>
                    <span>Talentino</span>
                  </div>
                </>
              )}

              {/* ONLY ADMINS SEE THESE */}
              {isSuperAdmin && (
                <>
                  <div className="qa-btn hover-lift" onClick={()=>navigate('/reports')}>
                    <div className="qa-icon blue"><ChartBar weight="fill"/></div>
                    <span>Reports</span>
                  </div>
                </>
              )}

              {/* TRAINERS / TTH SEE THIS */}
              {isTrainer && !isSuperAdmin && (
                <div className="qa-btn hover-lift" onClick={()=>navigate('/trainer-logs')}>
                  <div className="qa-icon green"><ChalkboardTeacher weight="fill"/></div>
                  <span>My Logs</span>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: LISTS */}
        <div className="grid-main-charts" style={{ marginTop: '20px' }}>
          
          {/* RECENT PLACEMENTS */}
          <div className="dash-card premium-shadow">
            <div className="card-header">
              <h3 className="card-title">Live Placement Feed</h3>
              <button className="premium-text-btn" onClick={()=>navigate('/placed')}>View All →</button>
            </div>
            
            <div className="list-container">
              {recentPlacements.length > 0 ? recentPlacements.map((p, i) => (
                <div key={i} className="list-row hover-bg">
                  <div className="row-left">
                    <div className="avatar-circle">{p.name.charAt(0)}</div>
                    <div>
                      <div className="row-title">{p.name}</div>
                      <div className="row-sub">{p.course}</div>
                    </div>
                  </div>
                  <div className="row-right">
                    <div style={{ textAlign: 'right' }}>
                      <div className="row-title text-blue">{p.company}</div>
                      <div className="row-sub">{p.packageLpa ? `${String(p.packageLpa).toUpperCase().replace('LPA', '').trim()} LPA` : 'Offer Received'}</div>
                    </div>
                  </div>
                </div>
              )) : <div className="empty-state">No recent placements found.</div>}
            </div>
          </div>

          {/* UPCOMING EVENTS / TRAINER LOGS BASED ON ROLE */}
          {isTrainer && !isSuperAdmin ? (
            <div className="dash-card premium-shadow">
              <div className="card-header">
                <h3 className="card-title">My Recent Trainer Logs</h3>
                <button className="premium-text-btn" onClick={()=>navigate('/trainer-logs')}>History →</button>
              </div>
              <div className="list-container">
                {trainerLogs.length > 0 ? trainerLogs.map((l, i) => (
                  <div key={i} className="list-row hover-bg">
                    <div className="row-left">
                      <div className="icon-circle green"><ChalkboardTeacher weight="fill"/></div>
                      <div>
                        <div className="row-title">{l.course}</div>
                        <div className="row-sub">{l.timestamp.split(' ')[0]}</div>
                      </div>
                    </div>
                    <div className="row-right">
                      <div className="status-pill green">{l.present} Present</div>
                      <div className="status-pill red">{l.absentees} Absent</div>
                    </div>
                  </div>
                )) : <div className="empty-state">No logs submitted recently.</div>}
              </div>
            </div>
          ) : (
            <div className="dash-card premium-shadow">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Upcoming Schedule</h3>
                  <p className="card-subtitle">Placement Drives & Talentino Sessions</p>
                </div>
                <button className="premium-text-btn" onClick={()=>navigate('/events')}>Calendar →</button>
              </div>
              
              <div className="list-container">
                {upcomingEvents.length === 0 ? <div className="empty-state">No upcoming events scheduled.</div> : 
                  upcomingEvents.map((evt, i) => {
                    const dateObj = parseDateRobust(evt.date);
                    return (
                    <div key={i} className="list-row hover-bg">
                      <div className="row-left">
                        <div className="calendar-box">
                          <span className="cal-month">{dateObj ? dateObj.toLocaleString('en-us', { month: 'short' }) : 'TBD'}</span>
                          <span className="cal-day">{dateObj ? dateObj.getDate() : '-'}</span>
                        </div>
                        <div>
                          <div className="row-title">{evt.title}</div>
                          <div className="row-sub" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPinLine size={12} /> {evt.location || 'Online'}
                          </div>
                        </div>
                      </div>
                      <div className="row-right">
                        <span className={`status-pill ${evt.type.toLowerCase().includes('drive') ? 'blue' : 'purple'}`}>
                          {evt.type}
                        </span>
                      </div>
                    </div>
                  )})}
              </div>
            </div>
          )}

        </div>

        {/* ---------------------------------------------------------
            🎨 PREMIUM STYLESHEET
        --------------------------------------------------------- */}
        <style>{`
          .db-wrapper { font-family: 'Inter', sans-serif; }
          
          .welcome-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; flex-wrap: wrap; gap: 15px; }
          .role-badge { background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; letter-spacing: 1px; }
          .date-pill { background: #1e293b; border: 1px solid #334155; padding: 10px 20px; border-radius: 30px; color: #cbd5e1; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; font-weight: 500; }
          
          .dash-card { background: #111827; border: 1px solid #1e293b; border-radius: 16px; padding: 25px; display: flex; flex-direction: column; position: relative; overflow: hidden; }
          .premium-shadow { box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5); }
          .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: default; }
          .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: #334155; }
          
          .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 20px; }
          .kpi-card { background: linear-gradient(145deg, #111827 0%, #0f1523 100%); border: 1px solid #1e293b; border-radius: 16px; padding: 25px; position: relative; overflow: hidden; }
          .kpi-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
          .kpi-title { font-size: 0.85rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          .kpi-val { font-size: 2.2rem; font-weight: 800; color: #fff; line-height: 1.2; margin-top: 5px; }
          .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
          .kpi-icon.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
          .kpi-icon.green { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
          .kpi-icon.purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.2); }
          .kpi-icon.orange { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
          .kpi-bottom { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 6px; }
          .trend-up { color: #10b981; font-weight: bold; background: rgba(16, 185, 129, 0.1); padding: 2px 6px; border-radius: 4px; }
          
          .grid-main-charts { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
          @media (max-width: 1100px) { .grid-main-charts { grid-template-columns: 1fr; } }
          
          .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
          .card-title { margin: 0; font-size: 1.1rem; color: #fff; font-weight: 700; }
          .card-subtitle { margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b; }
          .premium-select { background: #1e293b; color: #fff; border: 1px solid #334155; border-radius: 8px; padding: 6px 12px; font-size: 0.85rem; outline: none; cursor: pointer; font-weight: 500; }
          .premium-text-btn { background: transparent; border: none; color: #3b82f6; font-size: 0.9rem; cursor: pointer; font-weight: bold; transition: 0.2s; }
          .premium-text-btn:hover { color: #60a5fa; transform: translateX(3px); }
          
          .domain-legend { display: flex; flex-direction: column; gap: 12px; margin-top: 10px; }
          .legend-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 8px; border: 1px solid transparent; transition: 0.2s; }
          .legend-item:hover { background: #1e293b; border-color: #334155; }
          
          /* PIPELINE */
          .pipeline-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; padding: 20px; background: rgba(15, 23, 42, 0.5); border-radius: 12px; border: 1px solid #1e293b; }
          .pipe-stage { display: flex; flex-direction: column; align-items: center; gap: 10px; flex: 1; }
          .pipe-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid; }
          .pipe-data { text-align: center; }
          .pipe-val { font-size: 1.4rem; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 4px; }
          .pipe-lbl { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
          .pipe-arrow { color: #334155; font-size: 1.2rem; }
          @media (max-width: 600px) { .pipeline-container { flex-direction: column; gap: 20px; } .pipe-arrow { transform: rotate(90deg); } }
          
          .conversion-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .metric-box { background: linear-gradient(to bottom right, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.8)); padding: 15px; border-radius: 10px; border: 1px solid #1e293b; display: flex; flex-direction: column; gap: 5px; }
          .metric-box span { color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 600; }
          .metric-box strong { color: #fff; font-size: 1.2rem; font-weight: 800; }
          
          /* QUICK ACCESS GRID */
          .quick-access-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .qa-btn { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 15px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; cursor: pointer; color: #cbd5e1; font-weight: 600; font-size: 0.8rem; text-align: center; }
          .qa-btn:hover { background: #2dd4bf; color: #000; border-color: #2dd4bf; }
          .qa-btn:hover .qa-icon { background: rgba(0,0,0,0.1); color: #000; border-color: transparent; }
          .qa-icon { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #334155; background: #0f1523; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: 0.2s; }
          .qa-icon.blue { color: #3b82f6; } .qa-icon.orange { color: #f59e0b; } .qa-icon.pink { color: #ec4899; } .qa-icon.teal { color: #0ea5e9; } .qa-icon.purple { color: #a855f7; } .qa-icon.green { color: #10b981; } .qa-icon.yellow { color: #eab308; }
          
          /* LIST STYLES */
          .list-container { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
          .list-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid transparent; border-radius: 10px; transition: 0.2s; }
          .hover-bg:hover { background: #1e293b; border-color: #334155; }
          .row-left { display: flex; align-items: center; gap: 15px; }
          .avatar-circle { width: 38px; height: 38px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; }
          .icon-circle { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
          .icon-circle.green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
          .row-title { color: #fff; font-weight: 600; font-size: 0.95rem; margin-bottom: 3px; }
          .row-sub { color: #64748b; font-size: 0.8rem; }
          .text-blue { color: #3b82f6; }
          
          .calendar-box { background: #0f1523; border: 1px solid #1e293b; border-radius: 8px; width: 45px; height: 45px; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
          .cal-month { background: #3b82f6; color: #fff; width: 100%; text-align: center; font-size: 0.6rem; font-weight: bold; text-transform: uppercase; padding: 2px 0; }
          .cal-day { font-size: 1.1rem; font-weight: 800; color: #fff; padding: 2px 0; }
          
          .status-pill { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; }
          .status-pill.green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
          .status-pill.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
          .status-pill.purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
          .status-pill.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
          
          .empty-state { text-align: center; padding: 30px; color: #64748b; font-size: 0.9rem; border: 1px dashed #334155; border-radius: 10px; margin-top: 10px; }
        `}</style>
      </div>
    </Layout>
  );
}